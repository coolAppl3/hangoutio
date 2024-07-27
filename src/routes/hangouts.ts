import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import bcrypt from 'bcrypt';
import * as hangoutValidation from '../util/validation/hangoutValidation';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { generatePlaceHolders } from '../util/generatePlaceHolders';
import { isValidAuthTokenString, isValidDisplayNameString, isValidNewPasswordString, isValidPasswordString, isValidUsernameString } from '../util/validation/userValidation';
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

  if (!hangoutValidation.isValidHangoutMemberLimit(requestData.memberLimit)) {
    res.status(400).json({ success: false, message: 'Invalid member limit.' });
    return;
  };

  const { availabilityPeriod, suggestionsPeriod, votingPeriod }: RequestData = requestData;
  if (!hangoutValidation.isValidHangoutConfiguration(availabilityPeriod, suggestionsPeriod, votingPeriod)) {
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
    username: string,
    password: string,
    displayName: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutPassword', 'memberLimit', 'availabilityPeriod', 'suggestionsPeriod', 'votingPeriod', 'username', 'password', 'displayName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (requestData.hangoutPassword !== null && !isValidNewPasswordString(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutMemberLimit(requestData.memberLimit)) {
    res.status(400).json({ success: false, message: 'Invalid member limit.' });
    return;
  };

  const { availabilityPeriod, suggestionsPeriod, votingPeriod }: RequestData = requestData;
  if (!hangoutValidation.isValidHangoutConfiguration(availabilityPeriod, suggestionsPeriod, votingPeriod)) {
    res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
    return;
  };

  if (!isValidUsernameString(requestData.username)) {
    res.status(400).json({ success: false, message: 'Invalid username.' });
    return;
  };

  if (!isValidNewPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid guest password.' });
    return;
  };

  if (!isValidDisplayNameString(requestData.displayName)) {
    res.status(400).json({ success: false, message: 'Invalid display name.' });
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
      username: string,
      hashedPassword: string,
      displayName: string,
      hangoutID: string,
    };

    const hashedPassword: string = await bcrypt.hash(requestData.password, 10);
    const newGuestData: NewGuestData = {
      username: requestData.username,
      hashedPassword,
      displayName: requestData.displayName,
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
      `UPDATE
        Hangouts
      SET
        hashed_password = ?
      WHERE
        hangout_id = ?;`,
      [newHashedPassword, requestData.hangoutID]
    );

    res.json({ success: true, message: 'Password successfully updated.' });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.put('/details/changeMemberLimit', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    newLimit: number,
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

  const expectedKeys: string[] = ['hangoutID', 'newLimit'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
    res.status(404).json({ success: 'false', message: 'Hangout not found.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutMemberLimit(requestData.newLimit)) {
    res.status(409).json({ success: false, message: 'Invalid new member limit.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Hangouts.member_limit,
        HangoutMembers.auth_token,
        HangoutMembers.is_leader
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

    const isHangoutLeader: any | undefined = rows.find((member: any) => member.auth_token === authToken && member.is_leader);
    if (!isHangoutLeader) {
      res.status(401).json({ success: false, message: 'Not hangout leader. Request denied.' });
      return;
    };

    const currentMemberLimit: number = rows[0].member_limit;
    if (currentMemberLimit === requestData.newLimit) {
      res.status(409).json({ success: false, message: `Member limit is already set to ${requestData.newLimit}.` });
      return;
    };

    const numberOfCurrentMembers: number = rows.length;
    if (requestData.newLimit < numberOfCurrentMembers) {
      res.status(409).json({ success: false, message: 'New member limit is less than the number of existing members.' });
      return;
    };

    await dbPool.execute(
      `UPDATE
        Hangouts
      SET
        member_limit = ?
      WHERE
        hangout_id = ?;`,
      [requestData.newLimit, requestData.hangoutID]
    );

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.put('/details/steps/changePeriods', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    newAvailabilityPeriod: number,
    newSuggestionsPeriod: number,
    newVotingPeriod: number,
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

  const expectedKeys: string[] = ['hangoutID', 'newAvailabilityPeriod', 'newSuggestionsPeriod', 'newVotingPeriod'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  const { newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod }: RequestData = requestData;
  if (!hangoutValidation.isValidHangoutConfiguration(newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod)) {
    res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Hangouts.current_step,
        Hangouts.step_timestamp,
        Hangouts.availability_period,
        Hangouts.suggestions_period,
        Hangouts.voting_period,
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
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const leaderAuthToken: string = rows[0].auth_token;
    if (authToken !== leaderAuthToken) {
      res.status(401).json({ success: false, message: 'Not hangout leader. Request denied.' });
      return;
    };

    interface HangoutDetails {
      currentStep: number,
      stepTimestamp: number,
      currentAvailabilityPeriod: number,
      currentSuggestionsPeriod: number,
      currentVotingPeriod: number,
    };

    interface NewPeriods {
      newAvailabilityPeriod: number,
      newSuggestionsPeriod: number,
      newVotingPeriod: number,
    };

    const hangoutDetails: HangoutDetails = {
      currentStep: rows[0].current_step,
      stepTimestamp: rows[0].step_timestamp,
      currentAvailabilityPeriod: rows[0].availability_period,
      currentSuggestionsPeriod: rows[0].suggestions_period,
      currentVotingPeriod: rows[0].voting_period,
    };

    const newPeriods: NewPeriods = {
      newAvailabilityPeriod: requestData.newAvailabilityPeriod,
      newSuggestionsPeriod: requestData.newSuggestionsPeriod,
      newVotingPeriod: requestData.newVotingPeriod,
    };

    if (!hangoutValidation.isValidNewPeriods(hangoutDetails, newPeriods)) {
      res.status(409).json({ success: false, message: 'Invalid new configuration.' });
      return;
    };

    await dbPool.execute(
      `UPDATE
        Hangouts
      SET
        availability_period = ?,
        suggestions_period = ?,
        voting_period = ?
      WHERE
        hangout_id = ?
      LIMIT 1;`,
      [newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod, requestData.hangoutID]
    );

    res.json({ success: true, resData: { newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod } });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.put('/details/steps/progress', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
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

  const expectedKeys: string[] = ['hangoutID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutIDString) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Hangouts.current_step,
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
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const leaderAuthToken: string = rows[0].auth_token;
    if (authToken !== leaderAuthToken) {
      res.status(401).json({ success: false, message: 'Not hangout leader. Request denied.' });
      return;
    };

    const currentHangoutStep: number = rows[0].current_step;

    if (currentHangoutStep === 4) {
      res.status(400).json({ success: false, message: 'Hangout is completed.' });
      return;
    };

    if (currentHangoutStep < 3) {
      await dbPool.execute(
        `UPDATE
          Hangouts
        SET
          current_step = current_step + 1
        WHERE
          hangout_id = ?;`,
        [requestData.hangoutID]
      );

      res.json({ success: true, resData: { newStep: currentHangoutStep + 1, completed: false } })
      return;
    };

    await dbPool.execute(
      `UPDATE
        Hangouts
      SET
        current_step = ?,
        completed_on_timestamp = ?
      WHERE
        hangout_id = ?;`,
      [4, Date.now(), requestData.hangoutID]
    );

    res.json({ success: true, resData: { newStep: 4, completed: true } });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.put('/details/members/kick', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutMemberID: number,
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

  const expectedKeys: string[] = ['hangoutID', 'hangoutMemberID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        hangout_member_id,
        auth_token,
        is_leader
      FROM
        HangoutMembers
      WHERE
        hangout_id = ?;`,
      [requestData.hangoutID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const isHangoutLeader: any | undefined = rows.find((member: any) => member.auth_token === authToken && member.is_leader);
    if (!isHangoutLeader) {
      res.status(401).json({ success: false, message: 'Not hangout leader. Request denied.' });
      return;
    };

    const memberToKick: any = rows.find((member: any) => member.hangout_member_id === requestData.hangoutMemberID);
    if (!memberToKick) {
      res.status(404).json({ success: false, message: 'Member not found.' });
      return;
    };

    if (memberToKick.auth_token === authToken) {
      res.status(409).json({ success: false, message: 'Can not kick yourself.' });
      return;
    };

    await dbPool.execute(
      `DELETE FROM
        HangoutMembers
      WHERE
        hangout_member_id = ?;`,
      [requestData.hangoutMemberID]
    );

    if (memberToKick.auth_token.startsWith('g')) {
      await dbPool.execute(
        `DELETE FROM
          Guests
        WHERE
          auth_token = ?;`,
        [memberToKick.auth_token]
      );
    };

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.put('/details/members/transferLeadership', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutPassword: string,
    newLeaderMemberID: number,
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

  const expectedKeys: string[] = ['hangoutID', 'hangoutPassword', 'newLeaderMemberID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!isValidPasswordString(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.' });
    return;
  };

  if (!Number.isInteger(requestData.newLeaderMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid new leader hangout member ID.' });
    return;
  };

  let connection;

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Hangouts.hashed_password,
        HangoutMembers.hangout_member_id,
        HangoutMembers.auth_token,
        HangoutMembers.is_leader
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

    const hangoutHashedPassword: string = rows[0].hashed_password;
    const isCorrectPassword: boolean = await bcrypt.compare(requestData.hangoutPassword, hangoutHashedPassword);
    if (!isCorrectPassword) {
      res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
      return;
    };

    const isHangoutLeader: any | undefined = rows.find((member: any) => member.auth_token === authToken && member.is_leader);
    if (!isHangoutLeader) {
      res.status(401).json({ success: false, message: 'Not hangout leader. Request denied.' });
      return;
    };

    if (isHangoutLeader.hangout_member_id === requestData.newLeaderMemberID) {
      res.status(409).json({ success: false, message: 'You are already the hangout leader.' });
      return;
    };

    const newHangoutLeader: any | undefined = rows.find((member: any) => member.hangout_member_id === requestData.newLeaderMemberID);
    if (!newHangoutLeader) {
      res.status(404).json({ success: false, message: 'Member not found.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE
        HangoutMembers
      SET
        is_leader = ?
      WHERE
        hangout_id = ? AND
        auth_token = ?
      LIMIT 1;`,
      [false, requestData.hangoutID, authToken]
    );

    await connection.execute(
      `UPDATE
        HangoutMembers
      SET
        is_leader = TRUE
      WHERE
        hangout_id = ? AND
        hangout_member_id = ?
      LIMIT 1;`,
      [requestData.hangoutID, newHangoutLeader.hangout_member_id]
    );

    await connection.commit();
    res.json({ success: true, resData: {} });

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

hangoutsRouter.delete('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutPassword: string,
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

  if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!isValidPasswordString(requestData.hangoutPassword)) {
    res.status(400).json({ succesS: false, message: 'Invalid hangout password.' });
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
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutHashedPassword: string = rows[0].hashed_password;
    const isCorrectPassword: boolean = await bcrypt.compare(requestData.hangoutPassword, hangoutHashedPassword);
    if (!isCorrectPassword) {
      res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
      return;
    };

    const leaderAuthToken: string = rows[0].auth_token;
    if (authToken !== leaderAuthToken) {
      res.status(401).json({ success: false, message: 'Not hangout leader. Request Denied.' });
      return;
    };

    await dbPool.execute(
      `DELETE FROM
        Hangouts
      WHERE
        hangout_id = ?;`,
      [requestData.hangoutID]
    );

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});