import { dbPool } from '../db/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import * as hangoutValidation from '../util/validation/hangoutValidation';
import * as hangoutUtils from '../util/hangoutUtils';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { generatePlaceHolders } from '../util/generatePlaceHolders';
import { isValidAuthTokenString, isValidDisplayNameString, isValidNewPasswordString, isValidUsernameString } from '../util/validation/userValidation';
import { generateAuthToken, generateHangoutID } from '../util/tokenGenerator';
import { getUserID, getUserType } from '../util/userUtils';
import { addHangoutLog } from '../util/hangoutLogger';
import { getDateAndTimeSTring } from '../util/globalUtils';

export const hangoutsRouter: Router = express.Router();

hangoutsRouter.post('/create/accountLeader', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutPassword: string | null,
    memberLimit: number,
    availabilityStep: number,
    suggestionsStep: number,
    votingStep: number,
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

  const expectedKeys: string[] = ['hangoutPassword', 'memberLimit', 'availabilityStep', 'suggestionsStep', 'votingStep'];
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

  const { availabilityStep, suggestionsStep, votingStep }: RequestData = requestData;
  if (!hangoutValidation.isValidHangoutSteps(1, [availabilityStep, suggestionsStep, votingStep])) {
    res.status(400).json({ success: false, message: 'Invalid hangout steps.' });
    return;
  };

  let connection;

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

    const accountAuthToken: string = accountRows[0].auth_token;
    if (authToken !== accountAuthToken) {
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
        hangouts.is_concluded = FALSE AND
        hangout_members.account_id = ?
      LIMIT ${hangoutValidation.ongoingHangoutsLimit};`,
      [accountID]
    );

    if (ongoingHangoutsRows.length >= hangoutValidation.ongoingHangoutsLimit) {
      res.status(403).json({ success: false, message: 'Ongoing hangouts limit reached.' });
      return;
    };

    const createdOnTimestamp: number = Date.now();
    const hangoutID: string = generateHangoutID(createdOnTimestamp);
    const hashedPassword: string | null = requestData.hangoutPassword ? await bcrypt.hash(requestData.hangoutPassword, 10) : null;

    const nextStepTimestamp: number = createdOnTimestamp + availabilityStep;
    const conclusionTimestamp: number = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO hangouts(
        hangout_id,
        hashed_password,
        member_limit,
        availability_step,
        suggestions_step,
        voting_step,
        current_step,
        current_step_timestamp,
        next_step_timestamp,
        created_on_timestamp,
        conclusion_timestamp,
        is_concluded
      )
      VALUES(${generatePlaceHolders(12)});`,
      [hangoutID, hashedPassword, requestData.memberLimit, availabilityStep, suggestionsStep, votingStep, 1, createdOnTimestamp, nextStepTimestamp, createdOnTimestamp, conclusionTimestamp, false]
    );

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        is_leader
      )
      VALUES(${generatePlaceHolders(5)});`,
      [hangoutID, 'account', accountID, null, true]
    );

    await connection.commit();
    res.json({ success: true, resData: { hangoutID, hangoutMemberID: resultSetHeader.insertId } });

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (err.errno === 1062) {
      res.status(409).json({ success: false, message: 'Duplicate hangout ID.' });
      return;
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
    availabilityStep: number,
    suggestionsStep: number,
    votingStep: number,
    username: string,
    password: string,
    displayName: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutPassword', 'memberLimit', 'availabilityStep', 'suggestionsStep', 'votingStep', 'username', 'password', 'displayName'];
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

  const { availabilityStep, suggestionsStep, votingStep }: RequestData = requestData;
  if (!hangoutValidation.isValidHangoutSteps(1, [availabilityStep, suggestionsStep, votingStep])) {
    res.status(400).json({ success: false, message: 'Invalid hangout steps.' });
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
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    const [guestRows] = await connection.execute<RowDataPacket[]>(
      `SELECT
        1
      FROM
        guests
      WHERE
        username = ?
      LIMIT 1;`,
      [requestData.username]
    );

    if (guestRows.length > 0) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Username taken.' });

      return;
    };

    const createdOnTimestamp: number = Date.now();
    const hangoutID: string = generateHangoutID(createdOnTimestamp);
    const hashedHangoutPassword: string | null = requestData.hangoutPassword ? await bcrypt.hash(requestData.hangoutPassword, 10) : null;

    const nextStepTimestamp: number = createdOnTimestamp + availabilityStep;
    const conclusionTimestamp: number = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;

    await connection.execute(
      `INSERT INTO hangouts(
        hangout_id,
        hashed_password,
        member_limit,
        availability_step,
        suggestions_step,
        voting_step,
        current_step,
        current_step_timestamp,
        next_step_timestamp,
        created_on_timestamp,
        conclusion_timestamp,
        is_concluded
      )
      VALUES(${generatePlaceHolders(12)});`,
      [hangoutID, hashedHangoutPassword, requestData.memberLimit, availabilityStep, suggestionsStep, votingStep, 1, createdOnTimestamp, nextStepTimestamp, createdOnTimestamp, conclusionTimestamp, false]
    );

    const authToken: string = generateAuthToken('guest');
    const hashedGuestPassword: string = await bcrypt.hash(requestData.password, 10);

    const [firstResultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO guests(
        auth_token,
        username,
        hashed_password,
        display_name,
        hangout_id
      )
      VALUES(${generatePlaceHolders(5)});`,
      [authToken, requestData.username, hashedGuestPassword, requestData.displayName, hangoutID]
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

    const [thirdResultSetheader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${generatePlaceHolders(5)});`,
      [hangoutID, 'guest', null, guestID, requestData.displayName, true]
    );

    await connection.commit();
    res.json({ success: true, resData: { hangoutID, hangoutMemberID: thirdResultSetheader.insertId, authToken: idMarkedAuthToken } })

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (err.errno === 1062) {
      res.status(409).json({ success: false, message: 'Duplicate hangout ID.' });
      return;
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
    newPassword: string,
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

  const expectedKeys: string[] = ['hangoutID', 'newPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidNewPasswordString(requestData.newPassword)) {
    res.status(400).json({ success: false, message: 'Invalid new hangout password.' });
    return;
  };

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
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

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutDetails extends RowDataPacket {
      hashed_password: string | null,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.hashed_password,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`,
      [requestData.hangoutID]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const isHangoutLeader: boolean = hangoutRows.find((member: HangoutDetails) => member[`${userType}_id`] === userID && member.is_leader) !== undefined;
    if (!isHangoutLeader) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (hangoutDetails.hashed_password) {
      const isIdenticalPassword: boolean = await bcrypt.compare(requestData.newPassword, hangoutDetails.hashed_password);
      if (isIdenticalPassword) {
        res.status(409).json({ success: false, message: 'Identical password.' });
        return;
      };
    };

    const newHashedPassword: string = await bcrypt.hash(requestData.newPassword, 10);
    const [firstResultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        hashed_password = ?
      WHERE
        hangout_id = ?;`,
      [newHashedPassword, requestData.hangoutID]
    );

    if (firstResultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

    const logDescription: string = 'Hangout password was updated.';
    await addHangoutLog(requestData.hangoutID, logDescription);

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
  if (!isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userID: number = getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutID', 'newLimit'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
    res.status(404).json({ success: 'false', message: 'Invalid hangout ID.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutMemberLimit(requestData.newLimit)) {
    res.status(409).json({ success: false, message: 'Invalid new member limit.' });
    return;
  };

  let connection;

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
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

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutMember extends RowDataPacket {
      member_limit: number,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    const [hangoutMemberRows] = await connection.execute<HangoutMember[]>(
      `SELECT
        hangouts.member_limit,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`,
      [requestData.hangoutID]
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Hangout not found.' });

      return;
    };

    const isHangoutLeader: boolean = hangoutMemberRows.find((member: HangoutMember) => member[`${userType}_id`] === userID && member.is_leader) !== undefined;
    if (!isHangoutLeader) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Not hangout leader.' });

      return;
    };

    if (hangoutMemberRows[0].member_limit === requestData.newLimit) {
      await connection.rollback();
      res.status(409).json({ success: false, message: `Member limit is already set to ${requestData.newLimit}.` });

      return;
    };

    const numberOfCurrentMembers: number = hangoutMemberRows.length;
    if (requestData.newLimit < numberOfCurrentMembers) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'New member limit is less than the number of existing members.' });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        member_limit = ?
      WHERE
        hangout_id = ?;`,
      [requestData.newLimit, requestData.hangoutID]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: {} });

    const logDescription: string = `Hangout member limit was changed to ${requestData.newLimit}.`;
    await addHangoutLog(requestData.hangoutID, logDescription);

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

hangoutsRouter.put('/details/steps/update', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    newAvailabilityStep: number,
    newSuggestionsStep: number,
    newVotingStep: number,
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

  const expectedKeys: string[] = ['hangoutID', 'newAvailabilityStep', 'newSuggestionsStep', 'newVotingStep'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
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

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutDetails extends RowDataPacket {
      availability_step: number,
      suggestions_step: number,
      voting_step: number,
      current_step: number,
      current_step_timestamp: number,
      next_step_timestamp: number,
      created_on_timestamp: number,
      is_concluded: Boolean,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.availability_step,
        hangouts.suggestions_step,
        hangouts.voting_step,
        hangouts.current_step,
        hangouts.current_step_timestamp,
        hangouts.next_step_timestamp,
        hangouts.created_on_timestamp,
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`,
      [requestData.hangoutID]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const isHangoutLeader: boolean = hangoutRows.find((member: HangoutDetails) => member[`${userType}_id`] === userID && member.is_leader) !== undefined;
    if (!isHangoutLeader) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (hangoutDetails.is_concluded) {
      res.status(409).json({ success: false, message: 'Hangout already concluded.' });
      return;
    };

    const { newAvailabilityStep, newSuggestionsStep, newVotingStep }: RequestData = requestData;
    if (!hangoutValidation.isValidHangoutSteps(hangoutDetails.current_step, [newAvailabilityStep, newSuggestionsStep, newVotingStep])) {
      res.status(400).json({ success: false, message: 'Invalid mew hangout steps.' });
      return;
    };

    const newSteps = {
      newAvailabilityStep,
      newSuggestionsStep,
      newVotingStep,
    };

    if (!hangoutValidation.isValidNewHangoutSteps(hangoutDetails, newSteps)) {
      res.status(400).json({ success: false, message: 'Invalid new hangout steps.' });
      return;
    };

    const newConclusionTimestamp: number = hangoutDetails.created_on_timestamp + newAvailabilityStep + newSuggestionsStep + newVotingStep;
    const newNextStepTimestamp: number | null = hangoutUtils.getNextStepTimestamp(
      hangoutDetails.current_step,
      hangoutDetails.current_step_timestamp,
      hangoutDetails.availability_step,
      hangoutDetails.suggestions_step,
      hangoutDetails.voting_step,
    );

    const [firstResultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        availability_step = ?,
        suggestions_step = ?,
        voting_step = ?,
        next_step_timestamp = ?,
        conclusion_timestamp = ?
      WHERE
        hangout_id = ?;`,
      [newAvailabilityStep, newSuggestionsStep, newVotingStep, newNextStepTimestamp, newConclusionTimestamp, requestData.hangoutID]
    );

    if (firstResultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    const yearMilliseconds: number = 1000 * 60 * 60 * 24 * 365;

    const [secondResultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        availability_slots
      WHERE
        hangout_id = ? AND
        (slot_start_timestamp < ? OR slot_start_timestamp > ?);`,
      [requestData.hangoutID, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]
    );

    const [thirdResultSetheader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        hangout_id = ? AND
        (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`,
      [requestData.hangoutID, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]
    );

    const deletedAvailabilitySlots: number = secondResultSetHeader.affectedRows;
    const deletedSuggestions: number = thirdResultSetheader.affectedRows;

    res.json({
      success: true,
      resData: {
        newAvailabilityStep,
        newSuggestionsStep,
        newVotingStep,
        newNextStepTimestamp,
        newConclusionTimestamp,
        deletedAvailabilitySlots,
        deletedSuggestions,
      },
    });

    const logDescription: string = `Hangout steps have been updated and will now be concluded on ${getDateAndTimeSTring(newConclusionTimestamp)} as a result. ${deletedAvailabilitySlots || 'No'} availability slots and ${deletedSuggestions || 'no'} suggestions were deleted with this change.`;
    await addHangoutLog(requestData.hangoutID, logDescription);

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.put('/details/steps/progressForward', async (req: Request, res: Response) => {
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

  if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
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

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutDetails extends RowDataPacket {
      availability_step: number,
      suggestions_step: number,
      voting_step: number,
      current_step: number,
      current_step_timestamp: number,
      created_on_timestamp: number,
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.availability_step,
        hangouts.suggestions_step,
        hangouts.voting_step,
        hangouts.current_step,
        hangouts.current_step_timestamp,
        hangouts.created_on_timestamp,
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`,
      [requestData.hangoutID]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const isHangoutLeader: boolean = hangoutRows.find((member: HangoutDetails) => member[`${userType}_id`] === userID && member.is_leader) !== undefined;
    if (!isHangoutLeader) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (hangoutDetails.is_concluded) {
      res.status(409).json({ success: false, message: 'Hangout already concluded.' });
      return;
    };

    const requestTimestamp: number = Date.now();
    const updatedCurrentStep: number = requestTimestamp - hangoutDetails.current_step_timestamp;

    const currentStepName: string = hangoutUtils.getCurrentStepName(hangoutDetails.current_step);
    hangoutDetails[`${currentStepName}_step`] = updatedCurrentStep;

    const newCurrentStep: number = hangoutDetails.current_step + 1;

    const newNextStepTimestamp: number | null = hangoutUtils.getNextStepTimestamp(
      newCurrentStep,
      requestTimestamp,
      hangoutDetails.availability_step,
      hangoutDetails.suggestions_step,
      hangoutDetails.voting_step,
    );

    const { created_on_timestamp, availability_step, suggestions_step, voting_step }: HangoutDetails = hangoutDetails;
    const newConclusionTimestamp: number = created_on_timestamp + availability_step + suggestions_step + voting_step;

    if (hangoutDetails.current_step === 3) {
      const [firstResultSetHeader] = await dbPool.execute<ResultSetHeader>(
        `UPDATE
          hangouts
        SET
          availability_step = ?,
          suggestions_step = ?,
          voting_step = ?,
          current_step = ?,
          current_step_timestamp = ?,
          next_step_timestamp = ?,
          conclusion_timestamp = ?,
          is_concluded = ?
        WHERE
          hangout_id = ?;`,
        [availability_step, suggestions_step, voting_step, 4, requestTimestamp, newNextStepTimestamp, requestTimestamp, true, requestData.hangoutID]
      );

      if (firstResultSetHeader.affectedRows === 0) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
      };

      const yearMilliseconds: number = 1000 * 60 * 60 * 24 * 365;

      const [secondResultSetHeader] = await dbPool.execute<ResultSetHeader>(
        `DELETE FROM
          availability_slots
        WHERE
          hangout_id = ? AND
          (slot_start_timestamp < ? OR slot_start_timestamp > ?);`,
        [requestData.hangoutID, requestTimestamp, (requestTimestamp + yearMilliseconds)]
      );

      const [thirdResultSetheader] = await dbPool.execute<ResultSetHeader>(
        `DELETE FROM
          suggestions
        WHERE
          hangout_id = ? AND
          (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`,
        [requestData.hangoutID, requestTimestamp, (requestTimestamp + yearMilliseconds)]
      );

      const deletedAvailabilitySlots: number = secondResultSetHeader.affectedRows;
      const deletedSuggestions: number = thirdResultSetheader.affectedRows;

      res.json({
        success: true,
        resData: {
          newCurrentStep: 4,
          newNextStepTimestamp,
          newConclusionTimestamp: requestTimestamp,
          isConcluded: true,
          deletedAvailabilitySlots,
          deletedSuggestions,
        },
      });

      const logDescription: string = `Hangout has been manually progressed and is now concluded. ${deletedAvailabilitySlots || 'No'} availability slots and ${deletedSuggestions || 'no'} suggestions were deleted with this change.`;
      await addHangoutLog(requestData.hangoutID, logDescription);

      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        availability_step = ?,
        suggestions_step = ?,
        voting_step = ?,
        current_step = ?,
        current_step_timestamp = ?,
        next_step_timestamp = ?,
        conclusion_timestamp = ?,
        is_concluded = ?
      WHERE
        hangout_id = ?;`,
      [availability_step, suggestions_step, voting_step, newCurrentStep, requestTimestamp, newNextStepTimestamp, newConclusionTimestamp, false, requestData.hangoutID]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    const yearMilliseconds: number = 1000 * 60 * 60 * 24 * 365;

    const [secondResultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        availability_slots
      WHERE
        hangout_id = ? AND
        (slot_start_timestamp < ? OR slot_start_timestamp > ?);`,
      [requestData.hangoutID, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]
    );

    const [thirdResultSetheader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        hangout_id = ? AND
        (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`,
      [requestData.hangoutID, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]
    );

    const deletedAvailabilitySlots: number = secondResultSetHeader.affectedRows;
    const deletedSuggestions: number = thirdResultSetheader.affectedRows;

    res.json({
      success: true,
      resData: {
        newCurrentStep,
        newNextStepTimestamp,
        newConclusionTimestamp,
        isConcluded: false,
        deletedAvailabilitySlots,
        deletedSuggestions,
      },
    });

    const logDescription: string = `Hangout has been manually progressed, and will now be concluded on ${getDateAndTimeSTring(newConclusionTimestamp)} as a result. ${deletedAvailabilitySlots || 'No'} availability slots and ${deletedSuggestions || 'no'} suggestions were deleted with this change.`;
    await addHangoutLog(requestData.hangoutID, logDescription);

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
  if (!isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userID: number = getUserID(authToken);
  const requestData: RequestData = req.body;

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
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
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

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutMember extends RowDataPacket {
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
      display_name: string,
      is_leader: boolean,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        hangout_member_id,
        account_id,
        guest_id,
        display_name,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`,
      [requestData.hangoutID]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutLeader: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member[`${userType}_id`] === userID && member.is_leader);
    if (!hangoutLeader) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
      return;
    };

    if (hangoutLeader.hangout_member_id === requestData.hangoutMemberID) {
      res.status(403).json({ success: false, message: 'Can not kick yourself.' });
      return;
    };

    const memberToKick: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member.hangout_member_id === requestData.hangoutMemberID);
    if (!memberToKick) {
      res.status(404).json({ success: false, message: 'Member not found.' });
      return;
    };

    if (!memberToKick.account_id) {
      const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
        `DELETE FROM
          guests
        WHERE
          guest_id = ?;`,
        [memberToKick.guest_id]
      );

      if (resultSetHeader.affectedRows === 0) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
      };

      res.json({ success: true, resData: {} })
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
      [memberToKick.hangout_member_id]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

    const logDescription: string = `${memberToKick.display_name} was kicked by hangout leader.`;
    await addHangoutLog(requestData.hangoutID, logDescription);

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.put('/details/members/transferLeadership', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    newLeaderMemberID: number,
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

  const expectedKeys: string[] = ['hangoutID', 'newLeaderMemberID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.newLeaderMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid new leader hangout member ID.' });
    return;
  };

  let connection;

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
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

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutMember extends RowDataPacket {
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
      display_name: string,
      is_leader: boolean,
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    const [hangoutMemberRows] = await connection.execute<HangoutMember[]>(
      `SELECT
        hangout_member_id,
        account_id,
        guest_id,
        display_name,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`,
      [requestData.hangoutID]
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Hangout not found.' });

      return;
    };

    const hangoutLeader: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member[`${userType}_id`] === userID && member.is_leader);
    if (!hangoutLeader) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Not hangout leader.' });

      return;
    };

    if (hangoutLeader.hangout_member_id === requestData.newLeaderMemberID) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Already hangout leader.' });

      return;
    };

    const newHangoutLeader: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member.hangout_member_id === requestData.newLeaderMemberID);
    if (!newHangoutLeader) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Member not found.' });

      return;
    };

    const [firstResultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        hangout_members
      SET
        is_leader = FALSE
      WHERE
        hangout_member_id = ?;`,
      [hangoutLeader.hangout_member_id]
    );

    if (firstResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    const [secondResultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        hangout_members
      SET
        is_leader = TRUE
      WHERE
        hangout_member_id = ?;`,
      [newHangoutLeader.hangout_member_id]
    );

    if (secondResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: {} });

    const logDescription: string = `${hangoutLeader.display_name} has appointed ${newHangoutLeader.display_name} new hangout leader.`;
    await addHangoutLog(requestData.hangoutID, logDescription);

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

  if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
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

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutLeaderDetails extends RowDataPacket {
      account_id: number | null,
      guest_id: number | null,
    };

    const [hangoutLeaderRows] = await dbPool.execute<HangoutLeaderDetails[]>(
      `SELECT
        account_id,
        guest_id
      FROM
        hangout_members
      WHERE
        hangout_id = ? AND
        is_leader = TRUE
      LIMIT 1;`,
      [requestData.hangoutID]
    );

    if (hangoutLeaderRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutLeaderDetails: HangoutLeaderDetails = hangoutLeaderRows[0];
    if (hangoutLeaderDetails[`${userType}_id`] !== userID) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
      return;
    };

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

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});