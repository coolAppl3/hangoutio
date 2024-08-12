import { dbPool } from "../db/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { hangoutMemberLimit, isValidHangoutIDString, ongoingHangoutsLimit } from '../util/validation/hangoutValidation';
import { isValidAuthTokenString, isValidDisplayNameString, isValidNewPasswordString, isValidPasswordString, isValidUsernameString } from '../util/validation/userValidation';
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import { generateAuthToken } from "../util/tokenGenerator";
import { getUserID } from "../util/userUtils";

export const hangoutMembersRouter: Router = express.Router();

hangoutMembersRouter.post('/create/guestMember', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutPassword: string | null,
    username: string,
    password: string,
    displayName: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutID', 'hangoutPassword', 'username', 'password', 'displayName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (requestData.hangoutPassword !== null && !isValidPasswordString(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.' });
    return;
  };

  if (!isValidUsernameString(requestData.username)) {
    res.status(400).json({ success: false, message: 'Invalid username.' });
    return;
  };

  if (!isValidNewPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  if (!isValidDisplayNameString(requestData.displayName)) {
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
      [requestData.hangoutID]
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
      [authToken, requestData.username, guestHashedPassword, requestData.displayName, requestData.hangoutID]
    );

    const guestID: number = firstResultSetHeader.insertId;
    const idMarkedAuthToken: string = `${authToken}_${guestID}`;

    const [secondResultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        guests
      SET
        auth_token = ?
      WHERE
        guest_id = ?;`,
      [idMarkedAuthToken, guestID]
    );

    if (secondResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.execute(
      `INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        is_leader
      )
      VALUES(${generatePlaceHolders(5)});`,
      [requestData.hangoutID, 'guest', null, guestID, false]
    );

    await connection.commit();
    res.json({ success: true, resData: { authToken: idMarkedAuthToken } });

  } catch (err: any) {
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

hangoutMembersRouter.post('/create/accountMember', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutPassword: string | null,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const accountID: number = getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutID', 'hangoutPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (requestData.hangoutPassword !== null && !isValidPasswordString(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.' });
    return;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        auth_token
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [accountID]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== accountRows[0].auth_token) {
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
        hangouts.completed_on_timestamp IS NULL AND
        hangout_members.account_id = ?
      LIMIT ${ongoingHangoutsLimit};`,
      [accountID]
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
      [requestData.hangoutID]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const isMember: boolean = hangoutRows.find((member: HangoutDetails) => member.account_id === accountID) !== undefined;
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

    await dbPool.execute(
      `INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        is_leader
      )
      VALUES(${generatePlaceHolders(5)});`,
      [requestData.hangoutID, 'account', accountID, null, false]
    );

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutMembersRouter.put('/details/leaveHangout', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userID: number = getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  let connection;

  try {
    const userType: string = authToken.startsWith('a') ? 'account' : 'guest';

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
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const userAuthToken: string = userRows[0].auth_token;
    if (authToken !== userAuthToken) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutMember extends RowDataPacket {
      hangout_member_id: number,
      account_id: number,
      guest_id: number,
      is_leader: boolean
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        hangout_member_id,
        account_id,
        guest_id,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id = ?
      LIMIT ${hangoutMemberLimit};`,
      [requestData.hangoutID]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const userMember: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member[`${userType}_id`] === userID);
    if (!userMember) {
      res.status(403).json({ success: false, message: 'Not a member in this hangout.' });
      return;
    };

    if (!userMember.is_leader) {
      if (userMember.guest_id) {
        const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
          `DELETE FROM
            guests
          WHERE
            guest_id = ?;`,
          [userMember.guest_id]
        );

        if (resultSetHeader.affectedRows === 0) {
          res.status(500).json({ success: false, message: 'Internal server error.' });
          return;
        };

        res.json({ success: true, resData: {} });
        return;
      };

      const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
        `DELETE FROM
          hangout_members
        WHERE
          hangout_member_id = ?;`,
        [userMember.hangout_member_id]
      );

      if (resultSetHeader.affectedRows === 0) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
      };

      res.json({ success: true, resData: {} })
      return;
    };

    if (hangoutMemberRows.length < 2) { // leader, but the only member in the hangout
      const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
        `DELETE FROM
          hangouts
        WHERE
          hangout_id = ?;`,
        [requestData.hangoutID]
      );

      if (resultSetHeader.affectedRows === 0) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
      };

      res.json({ success: true, resData: {} })
      return;
    };

    const randomNewLeader: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member.hangout_member_id);
    if (!randomNewLeader) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const [firstResultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        hangout_members
      SET
        is_leader = TRUE
      WHERE
        hangout_member_id = ?;`,
      [randomNewLeader.hangout_member_id]
    );

    if (firstResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    const [secondResultSetHeader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
      [userMember.hangout_member_id]
    );

    if (secondResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: {} })

  } catch (err: any) {
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