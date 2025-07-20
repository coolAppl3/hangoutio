import http, { IncomingMessage } from "http";
import { dbPool } from "../../db/db";
import { RowDataPacket } from "mysql2";
import { isValidAuthSessionDetails, isValidAuthSessionId } from "../../auth/authUtils";
import { destroyAuthSession } from "../../auth/authSessions";
import { isValidHangoutId } from "../../util/validation/hangoutValidation";

import { Socket } from 'net';
import { wsMap, wss } from "./hangoutWebSocketServer";
import { WebSocket } from "ws";

export async function handleWebSocketUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): Promise<void> {
  socket.on('error', (err) => {
    if (('errno' in err) && err.errno === -4077) {
      socket.end();
      return;
    };

    console.log(err, err.stack)

    socket.write(`HTTP/1.1 ${http.STATUS_CODES[500]}\r\n\r\n`);
    socket.write('Internal server error\r\n');

    socket.end();
  });

  const memoryUsageMegabytes: number = process.memoryUsage().rss / Math.pow(1024, 2);
  const memoryThreshold: number = +(process.env.WS_ALLOW_MEMORY_THRESHOLD_MB || 500);

  if (memoryUsageMegabytes >= memoryThreshold) {
    socket.write(`HTTP/1.1 ${http.STATUS_CODES[509]}\r\n\r\n`);
    socket.write('Temporarily unavailable\r\n');

    socket.end();
    return;
  };

  const webSocketDetails: { hangoutMemberId: number, hangoutId: string } | null = await authenticateHandshake(req);

  if (!webSocketDetails) {
    socket.write(`HTTP/1.1 ${http.STATUS_CODES[401]}\r\n\r\n`);
    socket.write('Invalid credentials\r\n');

    socket.end();
    return;
  };

  wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
    const wsSet: Set<WebSocket> | undefined = wsMap.get(webSocketDetails.hangoutId);

    if (!wsSet) {
      wsMap.set(webSocketDetails.hangoutId, new Set([ws]));
      wss.emit('connection', ws, req);

      return;
    };

    wsSet.add(ws);
    wss.emit('connection', ws, req);
  });
};

export async function authenticateHandshake(req: IncomingMessage): Promise<{ hangoutMemberId: number, hangoutId: string } | null> {
  const cookieHeader: string | undefined = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  };

  const cookieHeaderArr: string[] = cookieHeader.split('; ');
  let authSessionId: string | null = null;

  for (const cookie of cookieHeaderArr) {
    const [cookieName, cookieValue] = cookie.split('=');

    if (!cookieName || !cookieValue) {
      continue;
    };

    if (cookieName === 'authSessionId' && isValidAuthSessionId(cookieValue)) {
      authSessionId = cookieValue;
      break;
    };
  };

  if (!authSessionId) {
    return null;
  };

  if (!req.url) {
    return null;
  };

  const url = new URL(req.url, `https://${req.headers.host}`);

  const hangoutMemberId: string | null = url.searchParams.get('hangoutMemberId');
  const hangoutId: string | null = url.searchParams.get('hangoutId');

  if (!hangoutMemberId || !Number.isInteger(+hangoutMemberId)) {
    return null;
  };

  if (!hangoutId || !isValidHangoutId(hangoutId)) {
    return null;
  };

  if (!(await isValidUserData(authSessionId, +hangoutMemberId, hangoutId))) {
    return null;
  };

  return { hangoutMemberId: +hangoutMemberId, hangoutId };
};

async function isValidUserData(authSessionId: string, hangoutMemberId: number, hangoutId: string): Promise<boolean> {
  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      return false;
    };

    if (!isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      return false;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      hangout_id: string,
      account_id: number | null,
      guest_id: number | null,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangout_id,
        account_id,
        guest_id
      FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
      [hangoutMemberId]

    );

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutMemberRows[0];

    if (!hangoutMemberDetails) {
      return false;
    };

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      return false;
    };

    if (hangoutMemberDetails.hangout_id !== hangoutId) {
      return false;
    };

    return true;

  } catch (err: unknown) {
    console.log(err);
    return false;
  };
};