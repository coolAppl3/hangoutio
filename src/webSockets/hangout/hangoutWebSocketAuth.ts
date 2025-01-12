import { IncomingMessage } from "http";
import { dbPool } from "../../db/db";
import { RowDataPacket } from "mysql2";
import { isValidAuthSessionDetails, isValidAuthSessionId } from "../../auth/authUtils";
import { destroyAuthSession } from "../../auth/authSessions";

export async function authenticateHandshake(req: IncomingMessage): Promise<number | null> {
  const cookieHeader: string | undefined = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  };

  const cookieHeaderArr: string[] = cookieHeader.split('; ');
  let authSessionId: string | null = null;

  for (const cookie of cookieHeaderArr) {
    const [cookieName, cookieValue] = cookie.split('=');

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

  if (!hangoutMemberId || !Number.isInteger(+hangoutMemberId)) {
    return null;
  };

  if (!(await isValidUserData(authSessionId, +hangoutMemberId))) {
    return null;
  };

  return +hangoutMemberId;
};

async function isValidUserData(authSessionId: string, hangoutMemberId: number): Promise<Boolean> {
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

    if (authSessionRows.length === 0) {
      return false;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

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
        account_id,
        guest_id
      FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
      [hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      return false;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      return false;
    };

    return true;

  } catch (err: unknown) {
    console.log(err);
    return false;
  };
};