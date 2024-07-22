import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import bcrypt from 'bcrypt';
import { isValidHangoutConfiguration, isValidHangoutMemberLimit } from '../util/validation/hangoutValidation';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { generatePlaceHolders } from '../util/generatePlaceHolders';
import { isValidAuthTokenString, isValidNameString, isValidNewPasswordString, isValidPasswordString } from '../util/validation/userValidation';
import { createGuestAccount, createHangout } from '../services/routersServices';

export const hangoutsRouter: Router = express.Router();

hangoutsRouter.post('/create/accountLeader', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutPassword: string | null,
    memberLimit: number,
    availabilityPeriod: number,
    suggestionsPeriod: number,
    votingPeriod: number,
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

  const expectedKeys: string[] = ['hangoutPassword', 'memberLimit', 'availabilityPeriod', 'suggestionsPeriod', 'votingPeriod'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (requestData.hangoutPassword !== null && !isValidNewPasswordString(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.' });
    return;
  };

  if (!isValidHangoutMemberLimit(requestData.memberLimit)) {
    res.status(400).json({ success: false, message: 'Invalid member limit.' });
    return;
  };

  const { availabilityPeriod, suggestionsPeriod, votingPeriod }: RequestData = requestData;
  if (!isValidHangoutConfiguration(availabilityPeriod, suggestionsPeriod, votingPeriod)) {
    res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
    return;
  };

  let connection;

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        is_verified
      FROM
        Accounts
      WHERE
        auth_token = ?
      LIMIT 1;`,
      [authToken]
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'Account not found.' });
      return;
    };

    const isVerified: boolean = rows[0].is_verified;
    if (!isVerified) {
      res.status(403).json({ success: false, message: 'Account not validated.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const hangoutID: string | false = await createHangout(connection, res, requestData);

    if (!hangoutID) {
      return;
    };

    await connection.execute(
      `INSERT INTO HangoutMembers(
        hangout_id,
        auth_token,
        is_leader
      )
      VALUES(${generatePlaceHolders(3)});`,
      [hangoutID, authToken, true]
    );

    await connection.commit();
    res.json({ success: true, resData: { hangoutID } });

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

hangoutsRouter.post('/create/guestLeader', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutPassword: string | null,
    memberLimit: number,
    availabilityPeriod: number,
    suggestionsPeriod: number,
    votingPeriod: number,
    userName: string,
    password: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutPassword', 'memberLimit', 'availabilityPeriod', 'suggestionsPeriod', 'votingPeriod', 'userName', 'password'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (requestData.hangoutPassword !== null && !isValidNewPasswordString(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.' });
    return;
  };

  if (!isValidHangoutMemberLimit(requestData.memberLimit)) {
    res.status(400).json({ success: false, message: 'Invalid member limit.' });
    return;
  };

  const { availabilityPeriod, suggestionsPeriod, votingPeriod }: RequestData = requestData;
  if (!isValidHangoutConfiguration(availabilityPeriod, suggestionsPeriod, votingPeriod)) {
    res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
    return;
  };

  if (!isValidNameString(requestData.userName)) {
    res.status(400).json({ success: false, message: 'Invalid guest name.' });
    return;
  };

  if (!isValidNewPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid guest password.' });
    return;
  };

  let connection;

  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const hangoutID: string | false = await createHangout(connection, res, requestData);

    if (!hangoutID) {
      return;
    };

    interface NewGuestData {
      userName: string,
      hashedPassword: string,
      hangoutID: string,
    };

    const hashedPassword: string = await bcrypt.hash(requestData.password, 10);

    const newGuestData: NewGuestData = {
      userName: requestData.userName,
      hashedPassword,
      hangoutID,
    };

    const authToken: string | false = await createGuestAccount(connection, res, newGuestData);
    if (!authToken) {
      return;
    };

    await connection.execute(
      `INSERT INTO HangoutMembers(
        hangout_id,
        auth_token,
        is_leader
      )
      VALUES(${generatePlaceHolders(3)});`,
      [hangoutID, authToken, true]
    );

    await connection.commit();
    res.json({ success: true, resData: { hangoutID, authToken } });

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


hangoutsRouter.put('/details/updatePassword', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    currentPassword: string | null,
    newPassword: string,
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

  const expectedKeys: string[] = ['hangoutID', 'currentPassword', 'newPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (requestData.currentPassword !== null && !isValidPasswordString(requestData.currentPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.' });
    return;
  };

  if (!isValidNewPasswordString(requestData.newPassword)) {
    res.status(400).json({ success: false, message: 'Invalid new hangout password.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Hangouts.hashed_password,
        HangoutMembers.auth_token
      FROM
        Hangouts
      LEFT JOIN
        HangoutMembers ON Hangouts.hangout_id = HangoutMembers.hangout_id
      WHERE
        Hangouts.hangout_id = ? AND
        HangoutMembers.is_leader = TRUE
      LIMIT 1;`,
      [requestData.hangoutID]
    );

    if (rows.length === 0) {
      res.status(404).json({ succesS: false, message: 'Hangout not found.' });
      return;
    };

    interface HangoutDetails {
      leaderAuthToken: string,
      hashedPassword: string | null,
    };

    const hangoutDetails: HangoutDetails = {
      leaderAuthToken: rows[0].auth_token,
      hashedPassword: rows[0].hashed_password,
    };

    if (authToken !== hangoutDetails.leaderAuthToken) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (requestData.currentPassword && hangoutDetails.hashedPassword) {
      const isCorrectPassword: boolean = await bcrypt.compare(requestData.currentPassword, hangoutDetails.hashedPassword);
      if (!isCorrectPassword) {
        res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
        return;
      };
    };

    const newHashedPassword: string = await bcrypt.hash(requestData.newPassword, 10);
    await dbPool.execute(
      `UPDATE Hangouts
        SET hashed_password = ?
      WHERE hangout_id = ?`,
      [newHashedPassword, requestData.hangoutID]
    );

    res.json({ success: true, message: 'Password successfully updated.' });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});