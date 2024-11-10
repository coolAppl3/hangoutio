import { IncomingMessage } from "http";
import { isValidAuthToken } from "../../util/validation/userValidation";
import { isValidHangoutID } from "../../util/validation/hangoutValidation";
import { dbPool } from "../../db/db";
import { RowDataPacket } from "mysql2";
import { getUserID, getUserType } from "../../util/userUtils";

export async function authenticateHandshake(req: IncomingMessage): Promise<{ hangoutId: string, hangoutMemberId: number } | null> {
  const authToken: string | undefined = req.headersDistinct['sec-websocket-protocol']?.[0];

  if (!authToken) {
    return null;
  };

  if (!isValidAuthToken(authToken)) {
    return null;
  };

  if (!req.url) {
    return null;
  };

  const url = new URL(req.url, `https://${req.headers.host}`);

  const hangoutMemberId: string | null = url.searchParams.get('hangoutMemberId');
  const hangoutId: string | null = url.searchParams.get('hangoutId');

  if (!hangoutMemberId || !hangoutId) {
    return null;
  };

  if (!Number.isInteger(+hangoutMemberId) || !isValidHangoutID(hangoutId)) {
    return null;
  };

  if (!(await isValidUserData(authToken, +hangoutMemberId, hangoutId))) {
    return null;
  };

  return { hangoutId, hangoutMemberId: +hangoutMemberId };
};

async function isValidUserData(authToken: string, hangoutMemberId: number, hangoutId: string): Promise<Boolean> {
  try {
    const userID: number = getUserID(authToken);
    const userType: 'account' | 'guest' = getUserType(authToken);

    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const [userRows] = await dbPool.execute<UserDetails[]>(
      `SELECT
        auth_token
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`,
      [userID]
    );

    if (userRows.length === 0) {
      return false;
    };

    if (authToken !== userRows[0].auth_token) {
      return false;
    };

    const [hangoutRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
        1
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        ${userType}_id = ? AND
        hangout_id = ?;`,
      [hangoutMemberId, userID, hangoutId]
    );

    if (hangoutRows.length === 0) {
      return false;
    };

    return true;

  } catch (err: unknown) {
    console.log(err);
    return false;
  };
};