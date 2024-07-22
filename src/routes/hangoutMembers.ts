import { dbPool } from "../db/db";
import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { isValidHangoutIDString } from '../util/validation/hangoutValidation';
import { isValidAuthTokenString, isValidNameString, isValidNewPasswordString, isValidPasswordString } from '../util/validation/userValidation';
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import { createGuestAccount } from "../services/routersServices";

export const hangoutMembersRouter: Router = express.Router();

hangoutMembersRouter.post('/create/guestMember', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutPassword: string | null,
    userName: string,
    password: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutID', 'hangoutPassword', 'userName', 'password'];
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

  if (!isValidNameString(requestData.userName)) {
    res.status(400).json({ success: false, message: 'Invalid guest name.' });
    return;
  };

  if (!isValidNewPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  let connection;

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Hangouts.hashed_password,
        Hangouts.member_limit,
        HangoutMembers.hangout_member_id
      FROM
        Hangouts
      LEFT JOIN
        HangoutMembers ON Hangouts.hangout_id = HangoutMembers.hangout_id
      WHERE
        Hangouts.hangout_id = ?;`,
      [requestData.hangoutID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    interface HangoutDetails {
      hangoutPassword: string | null,
      memberLimit: number,
    };

    const hangoutDetails: HangoutDetails = {
      hangoutPassword: rows[0].hashed_password,
      memberLimit: rows[0].member_limit,
    };

    const existingMembersCount: number = rows.length;
    if (existingMembersCount === hangoutDetails.memberLimit) {
      res.status(409).json({ success: false, message: 'Hangout full.' });
      return;
    };

    if (Boolean(hangoutDetails.hangoutPassword) !== Boolean(requestData.hangoutPassword)) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    if (hangoutDetails.hangoutPassword && requestData.hangoutPassword) {
      const isCorrectPassword: boolean = await bcrypt.compare(requestData.hangoutPassword, hangoutDetails.hangoutPassword);

      if (!isCorrectPassword) {
        res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
        return;
      };
    };

    const hashedPassword: string = await bcrypt.hash(requestData.password, 10);

    interface NewGuestData {
      userName: string,
      hashedPassword: string,
      hangoutID: string,
    };

    const newGuestData: NewGuestData = {
      userName: requestData.userName,
      hashedPassword,
      hangoutID: requestData.hangoutID,
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const guestAuthToken: string | boolean = await createGuestAccount(connection, res, newGuestData);
    if (!guestAuthToken) {
      return;
    };

    connection.execute(
      `INSERT INTO HangoutMembers(
        hangout_id,
        auth_token,
        is_leader
      )
      VALUES(${generatePlaceHolders(3)});`,
      [requestData.hangoutID, guestAuthToken, false]
    );

    connection.commit();
    res.json({ success: true, resData: { guestAuthToken } });

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (err.errno === 1452) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
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
  const requestData: RequestData = req.body;

  if (!isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

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
    const [accountRows]: any = await dbPool.execute(
      `SELECT
        is_verified
      FROM
        Accounts
      WHERE
        auth_token = ?`,
      [authToken]
    );

    if (accountRows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    const isVerified: boolean = accountRows[0].is_verified;
    if (!isVerified) {
      res.status(403).json({ success: false, message: 'Account not verified.' });
      return;
    };

    const [hangoutRows]: any = await dbPool.execute(
      `SELECT
        Hangouts.hashed_password,
        Hangouts.member_limit,
        HangoutMembers.auth_token
      FROM
        Hangouts
      LEFT JOIN
        HangoutMembers ON Hangouts.hangout_id = HangoutMembers.hangout_id
      WHERE
        Hangouts.hangout_id = ?;`,
      [requestData.hangoutID]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    for (const member of hangoutRows) {
      if (member.auth_token === authToken) {
        res.status(409).json({ success: false, message: 'Already a member of this hangout.' });
        return;
      };
    };

    interface HangoutDetails {
      hashedPassword: string | null,
      memberLimit: number,
    };

    const hangoutDetails: HangoutDetails = {
      hashedPassword: hangoutRows[0].hashed_password,
      memberLimit: hangoutRows[0].member_limit,
    };

    if (Boolean(hangoutDetails.hashedPassword) !== Boolean(requestData.hangoutPassword)) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    if (hangoutDetails.hashedPassword && requestData.hangoutPassword) {
      const isCorrectPassword: boolean = await bcrypt.compare(requestData.hangoutPassword, hangoutDetails.hashedPassword);

      if (!isCorrectPassword) {
        res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
        return;
      };
    };

    const existingMembersCount: number = hangoutRows.length;
    if (existingMembersCount === hangoutDetails.memberLimit) {
      res.status(409).json({ success: false, message: 'Hangout full.' });
      return;
    };

    await dbPool.execute(
      `INSERT INTO HangoutMembers(
        hangout_id,
        auth_token,
        is_leader
      )
      VALUES(${generatePlaceHolders(3)});`,
      [requestData.hangoutID, authToken, false]
    );

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);

    if (err.errno === 1452) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});