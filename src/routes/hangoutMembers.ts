import { dbPool } from "../db/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { hangoutMemberLimit, isValidHangoutId, ongoingHangoutsLimit } from '../util/validation/hangoutValidation';
import { isValidAuthToken, isValidDisplayName, isValidNewPassword, isValidPassword, isValidUsername } from '../util/validation/userValidation';
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import { generateAuthToken } from "../util/tokenGenerator";
import { getUserId, getUserType } from "../util/userUtils";
import { addHangoutLog } from "../util/hangoutLogger";
import { votesLimit } from "../util/validation/voteValidation";

export const hangoutMembersRouter: Router = express.Router();

hangoutMembersRouter.post('/create/accountMember', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutPassword: string | null,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthToken(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const accountId: number = getUserId(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (requestData.hangoutPassword !== null && !isValidPassword(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.' });
    return;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
      display_name: string,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        auth_token,
        display_name
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [accountId]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (authToken !== accountDetails.auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const [ongoingHangoutsRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
        hangouts.hangout_id,
        hangout_members.hangout_member_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.is_concluded = ? AND
        hangout_members.account_id = ?
      LIMIT ${ongoingHangoutsLimit};`,
      [false, accountId]
    );

    if (ongoingHangoutsRows.length >= ongoingHangoutsLimit) {
      res.status(403).json({ success: false, message: 'Ongoing hangouts limit reached.' });
      return;
    };

    interface HangoutDetails extends RowDataPacket {
      hashed_password: string | null,
      member_limit: number,
      account_id: number | null,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.hashed_password,
        hangouts.member_limit,
        hangout_members.account_id
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutMemberLimit};`,
      [requestData.hangoutId]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const isMember: boolean = hangoutRows.find((member: HangoutDetails) => member.account_id === accountId) !== undefined;
    if (isMember) {
      res.status(409).json({ success: false, message: 'Already a member of this hangout.' });
      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (Boolean(hangoutDetails.hashed_password) !== Boolean(requestData.hangoutPassword)) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    if (hangoutDetails.hashed_password && requestData.hangoutPassword) {
      const isCorrectPassword: boolean = await bcrypt.compare(requestData.hangoutPassword, hangoutDetails.hashed_password);

      if (!isCorrectPassword) {
        res.status(401).json({ success: false, message: 'Incorrect password.' });
        return;
      };
    };

    const existingMembersCount: number = hangoutRows.length;
    if (existingMembersCount >= hangoutDetails.member_limit) {
      res.status(409).json({ success: false, message: 'Hangout full.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${generatePlaceHolders(6)});`,
      [requestData.hangoutId, 'account', accountId, null, accountDetails.display_name, false]
    );

    res.json({ success: true, resData: { hangoutMemberId: resultSetHeader.insertId } });

    const logDescription: string = `${accountDetails.display_name} has joined the hangout.`;
    await addHangoutLog(requestData.hangoutId, logDescription);

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutMembersRouter.post('/create/guestMember', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutPassword: string | null,
    username: string,
    password: string,
    displayName: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutPassword', 'username', 'password', 'displayName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (requestData.hangoutPassword !== null && !isValidPassword(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.' });
    return;
  };

  if (!isValidUsername(requestData.username)) {
    res.status(400).json({ success: false, message: 'Invalid username.' });
    return;
  };

  if (!isValidNewPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  if (!isValidDisplayName(requestData.displayName)) {
    res.status(400).json({ success: false, message: 'Invalid display name.' });
    return;
  };

  let connection;

  try {
    interface HangoutDetails extends RowDataPacket {
      hashed_password: string | null,
      member_limit: number,
      hangout_member_id: number,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.hashed_password,
        hangouts.member_limit,
        hangout_members.hangout_member_id
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutMemberLimit};`,
      [requestData.hangoutId]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    const existingMembersCount: number = hangoutRows.length;
    if (existingMembersCount >= hangoutDetails.member_limit) {
      res.status(409).json({ success: false, message: 'Hangout full.' });
      return;
    };

    if (Boolean(hangoutDetails.hashed_password) !== Boolean(requestData.hangoutPassword)) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    if (hangoutDetails.hashed_password && requestData.hangoutPassword) {
      const isCorrectPassword: boolean = await bcrypt.compare(requestData.hangoutPassword, hangoutDetails.hashed_password);

      if (!isCorrectPassword) {
        res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
        return;
      };
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    const [usernameRows] = await connection.execute<RowDataPacket[]>(
      `SELECT
        1
      FROM
        guests
      WHERE
        username = ?
      LIMIT 1;`,
      [requestData.username]
    );

    if (usernameRows.length > 0) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Username taken.' });

      return;
    };

    const authToken: string = generateAuthToken('guest');
    const guestHashedPassword: string = await bcrypt.hash(requestData.password, 10);

    const [firstResultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO guests(
        auth_token,
        username,
        hashed_password,
        display_name,
        hangout_id
      )
      VALUES(${generatePlaceHolders(5)});`,
      [authToken, requestData.username, guestHashedPassword, requestData.displayName, requestData.hangoutId]
    );

    const guestId: number = firstResultSetHeader.insertId;
    const idMarkedAuthToken: string = `${authToken}_${guestId}`;

    const [secondResultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        guests
      SET
        auth_token = ?
      WHERE
        guest_id = ?;`,
      [idMarkedAuthToken, guestId]
    );

    if (secondResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    const [thirdResultSetheader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${generatePlaceHolders(6)});`,
      [requestData.hangoutId, 'guest', null, guestId, requestData.displayName, false]
    );

    await connection.commit();
    res.status(201).json({ success: true, resData: { authToken: idMarkedAuthToken, hangoutMemberId: thirdResultSetheader.insertId } });

    const logDescription: string = `${requestData.displayName} has joined the hangout.`;
    addHangoutLog(requestData.hangoutId, logDescription);

  } catch (err: unknown) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
  };
});

hangoutMembersRouter.delete(`/`, async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthToken(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userId: number = getUserId(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  let connection;

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
      display_name: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
    const [userRows] = await dbPool.execute<UserDetails[]>(
      `SELECT
        auth_token,
        display_name
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`,
      [userId]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const userDetails: UserDetails = userRows[0];

    if (authToken !== userDetails.auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutMember extends RowDataPacket {
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
      requester_votes_count: number,
      hangout_members_count: number,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMember[]>(
      `SELECT
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        (SELECT COUNT(*) FROM votes WHERE hangout_member_id = :hangoutMemberId) as requester_votes_count,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = :hangoutId) as hangout_members_count
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = :hangoutId AND
        hangout_members.hangout_member_id = :hangoutMemberId
      LIMIT 1;`,
      { hangoutId: requestData.hangoutId, hangoutMemberId: requestData.hangoutMemberId }
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userId) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    if (hangoutMember.hangout_members_count === 1) {
      const [resultSetHeader] = await connection.execute<ResultSetHeader>(
        `DELETE FROM
          hangouts
        WHERE
          hangout_id = ?;`,
        [requestData.hangoutId]
      );

      if (resultSetHeader.affectedRows === 0) {
        await connection.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });

        return;
      };

      await connection.commit();
      res.json({ success: true, resData: { hangoutDeleted: true, guestUserDeleted: false } });
    };

    if (hangoutMember.requester_votes_count > 0 && !hangoutMember.is_concluded) {
      const [resultSetHeader] = await connection.execute<ResultSetHeader>(
        `DELETE FROM
          votes
        WHERE
          hangout_member_id = ?
        LIMIT ${votesLimit};`,
        [requestData.hangoutMemberId]
      );

      if (resultSetHeader.affectedRows === 0) {
        await connection.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });

        return;
      };
    };

    if (hangoutMember.guest_id) {
      const [resultSetHeader] = await connection.execute<ResultSetHeader>(
        `DELETE FROM
          guests
        WHERE
          guest_id = ?;`,
        [userId]
      );

      if (resultSetHeader.affectedRows === 0) {
        await connection.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });

        return;
      };

      await connection.commit();
      res.json({ success: true, resData: { hangoutDeleted: false, guestUserDeleted: true } });

      const logDescription: string = `${userDetails.display_name} has left the hangout.${hangoutMember.is_leader ? ' Hangout leader role is available to be claimed.' : ''}`;
      await addHangoutLog(requestData.hangoutId, logDescription);

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
      [requestData.hangoutMemberId]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: { hangoutDeleted: false, guestUserDeleted: false } });

    const logDescription: string = `${userRows[0].display_name} has left the hangout.${hangoutMember.is_leader ? ' Hangout leader role is available to be claimed.' : ''}`;
    await addHangoutLog(requestData.hangoutId, logDescription);

  } catch (err: unknown) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
  };
});