import { IncomingMessage } from "http";
import { dbPool } from "../../db/db";
import { RowDataPacket } from "mysql2";
import { isValidAuthSessionDetails, isValidAuthSessionId } from "../../auth/authUtils";
import { destroyAuthSession } from "../../auth/authSessions";
import { isValidHangoutId } from "../../util/validation/hangoutValidation";

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

async function isValidUserData(authSessionId: string, hangoutMemberId: number, hangoutId: string): Promise<Boolean> {
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