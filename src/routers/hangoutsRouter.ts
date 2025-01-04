import { dbPool } from '../db/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import * as hangoutValidation from '../util/validation/hangoutValidation';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { generatePlaceHolders } from '../util/generatePlaceHolders';
import { isValidDisplayName, isValidNewPassword, isValidUsername } from '../util/validation/userValidation';
import { generateHangoutId } from '../util/tokenGenerator';
import { addHangoutEvent } from '../util/addHangoutEvent';
import { getDateAndTimeString } from '../util/globalUtils';
import { isSqlError } from '../util/isSqlError';
import { decryptPassword, encryptPassword } from '../util/encryptionUtils';
import * as authUtils from '../auth/authUtils';
import { getRequestCookie, removeRequestCookie, setResponseCookie } from '../util/cookieUtils';
import { createAuthSession, destroyAuthSession } from '../auth/authSessions';
import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE, hourMilliseconds, MAX_ONGOING_HANGOUTS_LIMIT } from '../util/constants';
import { HangoutEvent, HangoutMember, HangoutMemberCountables, HangoutMessage, HangoutsDetails } from '../util/hangoutTypes';

export const hangoutsRouter: Router = express.Router();

hangoutsRouter.post('/create/accountLeader', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutTitle: string,
    hangoutPassword: string | null,
    membersLimit: number,
    availabilityPeriod: number,
    suggestionsPeriod: number,
    votingPeriod: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutTitle', 'hangoutPassword', 'membersLimit', 'availabilityPeriod', 'suggestionsPeriod', 'votingPeriod'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutTitle(requestData.hangoutTitle)) {
    res.status(400).json({ success: false, message: 'Invalid hangout title.', reason: 'invalidHangoutTitle' });
    return;
  };

  if (requestData.hangoutPassword && !isValidNewPassword(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.', reason: 'invalidHangoutPassword' });
    return;
  };

  if (!hangoutValidation.isValidHangoutMembersLimit(requestData.membersLimit)) {
    res.status(400).json({ success: false, message: 'Invalid hangout members limit.', reason: 'invalidMembersLimit' });
    return;
  };

  const { availabilityPeriod, suggestionsPeriod, votingPeriod }: RequestData = requestData;
  if (!hangoutValidation.isValidHangoutPeriods([availabilityPeriod, suggestionsPeriod, votingPeriod])) {
    res.status(400).json({ success: false, message: 'Invalid hangout stages configuration.', reason: 'invalidHangoutPeriods' });
    return;
  };

  let connection;

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
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface AccountDetails extends RowDataPacket {
      display_name: string,
      ongoing_hangouts_count: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        display_name,
        (SELECT COUNT(*) FROM hangout_members WHERE account_id = :accountId) AS ongoing_hangouts_count
      FROM
        accounts
      WHERE
        account_id = :accountId;`,
      { accountId: authSessionDetails.user_id }
    );

    if (accountRows.length === 0) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (accountDetails.ongoing_hangouts_count >= MAX_ONGOING_HANGOUTS_LIMIT) {
      res.status(409).json({
        success: false,
        message: `You've reached the limit of ${MAX_ONGOING_HANGOUTS_LIMIT} ongoing hangouts.`,
        reason: 'hangoutsLimitReached',
      });

      return;
    };

    const currentTimestamp: number = Date.now();
    const hangoutId: string = generateHangoutId(currentTimestamp);

    const encryptedHangoutPassword: string | null = requestData.hangoutPassword ? encryptPassword(requestData.hangoutPassword) : null;

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO hangouts (
        hangout_id,
        hangout_title,
        encrypted_password,
        members_limit,
        availability_period,
        suggestions_period,
        voting_period,
        current_stage,
        stage_control_timestamp,
        created_on_timestamp,
        is_concluded
      ) VALUES (${generatePlaceHolders(11)});`,
      [hangoutId, requestData.hangoutTitle, encryptedHangoutPassword, requestData.membersLimit, availabilityPeriod, suggestionsPeriod, votingPeriod, 1, currentTimestamp, currentTimestamp, false]
    );

    await connection.execute(
      `INSERT INTO hangout_members (
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      ) VALUES (${generatePlaceHolders(6)});`,
      [hangoutId, 'account', authSessionDetails.user_id, null, accountDetails.display_name, true]
    );

    await connection.commit();
    res.status(201).json({ success: true, resData: { hangoutId } });

    await addHangoutEvent(hangoutId, `${accountDetails.display_name} created the hangout.`, currentTimestamp);

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    if (!isSqlError(err)) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    const sqlError: SqlError = err;

    if (sqlError.errno === 1062) {
      res.status(409).json({ success: false, message: 'Duplicate hangout ID.', reason: 'duplicateHangoutId' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

hangoutsRouter.post('/create/guestLeader', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutTitle: string,
    hangoutPassword: string | null,
    membersLimit: number,
    availabilityPeriod: number,
    suggestionsPeriod: number,
    votingPeriod: number,
    username: string,
    password: string,
    displayName: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutTitle', 'hangoutPassword', 'membersLimit', 'availabilityPeriod', 'suggestionsPeriod', 'votingPeriod', 'username', 'password', 'displayName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutTitle(requestData.hangoutTitle)) {
    res.status(400).json({ success: false, message: 'Invalid hangout title.', reason: 'invalidHangoutTitle' });
    return;
  };

  if (requestData.hangoutPassword && !isValidNewPassword(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.', reason: 'invalidHangoutPassword' });
    return;
  };

  if (!hangoutValidation.isValidHangoutMembersLimit(requestData.membersLimit)) {
    res.status(400).json({ success: false, message: 'Invalid hangout members limit.', reason: 'invalidMembersLimit' });
    return;
  };

  const { availabilityPeriod, suggestionsPeriod, votingPeriod }: RequestData = requestData;
  if (!hangoutValidation.isValidHangoutPeriods([availabilityPeriod, suggestionsPeriod, votingPeriod])) {
    res.status(400).json({ success: false, message: 'Invalid hangout stages configuration.', reason: 'invalidHangoutSteps' });
    return;
  };

  if (!isValidDisplayName(requestData.displayName)) {
    res.status(400).json({ success: false, message: 'Invalid guest display name.', reason: 'invalidDisplayName' });
    return;
  };

  if (!isValidUsername(requestData.username)) {
    res.status(400).json({ success: false, message: 'Invalid guest username.', reason: 'invalidUsername' });
    return;
  };

  if (!isValidNewPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid guest password.', reason: 'invalidGuestPassword' });
    return;
  };

  if (requestData.username === requestData.password) {
    res.status(409).json({ success: false, message: `Password can't be identical to username.`, reason: 'passwordEqualsUsername' });
    return;
  };

  let connection;

  try {
    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    const [guestRows] = await connection.execute<RowDataPacket[]>(
      `SELECT
        1 AS username_taken
      FROM
        guests
      WHERE
        username = ?
      LIMIT 1;`,
      [requestData.username]
    );

    if (guestRows.length > 0) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Username is already taken.', reason: 'guestUsernameTaken' });

      return;
    };

    const currentTimestamp: number = Date.now();
    const hangoutId: string = generateHangoutId(currentTimestamp);

    const encryptedHangoutPassword: string | null = requestData.hangoutPassword ? encryptPassword(requestData.hangoutPassword) : null;
    await connection.execute(
      `INSERT INTO hangouts (
        hangout_id,
        hangout_title,
        encrypted_password,
        members_limit,
        availability_period,
        suggestions_period,
        voting_period,
        current_stage,
        stage_control_timestamp,
        created_on_timestamp,
        is_concluded
      ) VALUES (${generatePlaceHolders(11)});`,
      [hangoutId, requestData.hangoutTitle, encryptedHangoutPassword, requestData.membersLimit, availabilityPeriod, suggestionsPeriod, votingPeriod, 1, currentTimestamp, currentTimestamp, false]
    );

    const hashedGuestPassword: string = await bcrypt.hash(requestData.password, 10);
    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO guests (
        username,
        hashed_password,
        display_name,
        hangout_id
      ) VALUES (${generatePlaceHolders(4)});`,
      [requestData.username, hashedGuestPassword, requestData.displayName, hangoutId]
    );

    const guestId: number = resultSetHeader.insertId;

    await connection.execute(
      `INSERT INTO hangout_members (
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      ) VALUES (${generatePlaceHolders(6)});`,
      [hangoutId, 'guest', null, guestId, requestData.displayName, true]
    );

    await connection.commit();

    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: guestId,
      user_type: 'guest',
      keepSignedIn: false,
    });

    if (authSessionCreated) {
      setResponseCookie(res, 'guestHangoutId', hangoutId, hourMilliseconds * 6, false);
    };

    res.status(201).json({ success: true, resData: { authSessionCreated, hangoutId } });

    await addHangoutEvent(hangoutId, `${requestData.displayName} created the hangout.`, currentTimestamp);

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    if (!isSqlError(err)) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    const sqlError: SqlError = err;

    if (sqlError.errno === 1062) {
      res.status(409).json({ success: false, message: 'Duplicate hangout ID.', reason: 'duplicateHangoutId' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

hangoutsRouter.patch('/details/updatePassword', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    newPassword: string | null,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'newPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (requestData.newPassword && !isValidNewPassword(requestData.newPassword)) {
    res.status(400).json({ success: false, message: 'Invalid new hangout password.' });
    return;
  };

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
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      hangout_id: string,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
      hangout_encrypted_password: string | null,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangout_id,
        account_id,
        guest_id,
        is_leader,
        (SELECT encrypted_password FROM hangouts WHERE hangout_id = ?) AS hangout_encrypted_password
      FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
      [requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.hangout_id !== requestData.hangoutId) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    if (!hangoutMemberDetails.is_leader) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
      return;
    };

    if (hangoutMemberDetails.hangout_encrypted_password === requestData.newPassword) { // only true if both are null
      res.status(409).json({ success: false, message: 'Hangout already has no password', reason: 'passwordAlreadyNull' });
      return;
    };

    const newEncryptedPassword: string | null = requestData.newPassword ? encryptPassword(requestData.newPassword) : null;
    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        encrypted_password = ?
      WHERE
        hangout_id = ?;`,
      [newEncryptedPassword, requestData.hangoutId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

    const eventDescription: string = 'Hangout password was updated.';
    await addHangoutEvent(requestData.hangoutId, eventDescription);

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.patch('/details/changeMembersLimit', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    newMembersLimit: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'newMembersLimit'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: 'false', message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutMembersLimit(requestData.newMembersLimit)) {
    res.status(409).json({ success: false, message: 'Invalid new members limit.' });
    return;
  };

  let connection;

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
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutDetails extends RowDataPacket {
      members_limit: number,
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
      current_members_count: number,
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    const [hangoutRows] = await connection.execute<HangoutDetails[]>(
      `SELECT
        hangouts.member_limit,
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = :hangoutId) AS current_member_count
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

    if (hangoutRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Hangout not found.' });

      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (hangoutDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });

      return;
    };

    if (!hangoutDetails.is_leader) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Not hangout leader.' });

      return;
    };

    if (hangoutDetails.is_concluded) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Hangout is concluded.' });

      return;
    };

    if (hangoutDetails.member_limit === requestData.newMembersLimit) {
      await connection.rollback();
      res.status(409).json({ success: false, message: `Hangout already has this members limit.` });

      return;
    };

    if (requestData.newMembersLimit < hangoutDetails.current_member_count) {
      await connection.rollback();
      res.status(409).json({ success: false, message: `New members limit can't be lower than the number of existing members.` });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        member_limit = ?
      WHERE
        hangout_id = ?;`,
      [requestData.newMembersLimit, requestData.hangoutId]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: {} });

    const eventDescription: string = `Hangout members limit was changed to ${requestData.newMembersLimit}.`;
    await addHangoutEvent(requestData.hangoutId, eventDescription);

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

hangoutsRouter.patch('/details/steps/update', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    newAvailabilityPeriod: number,
    newSuggestionsPeriod: number,
    newVotingPeriod: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'newAvailabilityPeriod', 'newSuggestionsPeriod', 'newVotingPeriod'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  let connection;

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
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutDetails extends RowDataPacket {
      availability_period: number,
      suggestions_period: number,
      voting_period: number,
      current_stage: number,
      stage_control_timestamp: number,
      created_on_timestamp: number,
      is_concluded: number,
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
    };

    const [hangoutRows] = await connection.execute<HangoutDetails[]>(
      `SELECT
        hangouts.availability_period,
        hangouts.suggestions_period,
        hangouts.voting_period,
        hangouts.current_stage,
        hangouts.stage_control_timestamp,
        hangouts.created_on_timestamp,
        hangouts.is_concluded,
        hangout_members.hangout_member_id,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT 1;`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Hangout not found.' });

      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (hangoutDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });

      return;
    };

    if (!hangoutDetails.is_leader) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Not hangout leader.' });

      return;
    };

    if (hangoutDetails.is_concluded) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Hangout is already concluded.' });

      return;
    };

    if (!hangoutValidation.isValidNewHangoutPeriods(
      { currentStage: hangoutDetails.current_stage, stageControlTimestamp: hangoutDetails.stage_control_timestamp },
      [hangoutDetails.availability_period, hangoutDetails.suggestions_period, hangoutDetails.voting_period],
      [requestData.newAvailabilityPeriod, requestData.newSuggestionsPeriod, requestData.newSuggestionsPeriod]
    )) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Invalid hangout stages configuration.' });

      return;
    };

    const [firstResultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        availability_period = ?,
        suggestions_period = ?,
        voting_period = ?
      WHERE
        hangout_id = ?;`,
      [requestData.newAvailabilityPeriod, requestData.newSuggestionsPeriod, requestData.newVotingPeriod, requestData.hangoutId]
    );

    if (firstResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    const previousConclusionTimestamp: number = hangoutDetails.created_on_timestamp + hangoutDetails.availability_period + hangoutDetails.suggestions_period + hangoutDetails.voting_period;

    const newConclusionTimestamp: number = hangoutDetails.created_on_timestamp + requestData.newAvailabilityPeriod + requestData.newSuggestionsPeriod + requestData.newVotingPeriod;

    await connection.commit();
    res.json({ success: true, resData: { newConclusionTimestamp } });

    if (newConclusionTimestamp < previousConclusionTimestamp) {
      await connection.query(
        `DELETE FROM
        availability_slots
      WHERE
        slot_start_timestamp < :newConclusionTimestamp AND
        hangout_id = :hangoutId;
      
      DELETE FROM
        suggestions
      WHERE
        suggestion_start_timestamp < :newConclusionTimestamp AND
        hangout_id = :hangoutId;  `,
        { newConclusionTimestamp, hangoutId: requestData.hangoutId }
      );
    };

    const newConclusionDateAndTime: string = getDateAndTimeString(newConclusionTimestamp);

    await addHangoutEvent(requestData.hangoutId, `Hangout stages have been updated. The hangout will now be concluded on ${newConclusionDateAndTime} as a result.`);

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

hangoutsRouter.patch('/details/steps/progressForward', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  let connection;

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
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    interface HangoutDetails extends RowDataPacket {
      availability_period: number,
      suggestions_period: number,
      voting_period: number,
      current_stage: number,
      stage_control_timestamp: number,
      created_on_timestamp: number,
      is_concluded: boolean,
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
      suggestions_count: number,
    };

    const [hangoutRows] = await connection.execute<HangoutDetails[]>(
      `SELECT
        hangouts.availability_period,
        hangouts.suggestions_period,
        hangouts.voting_period,
        hangouts.current_stage,
        hangouts.stage_control_timestamp,
        hangouts.created_on_timestamp,
        hangouts.is_concluded,
        hangout_members.hangout_member_id,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        (SELECT COUNT(*) FROM suggestions WHERE hangout_id = :hangoutId) AS suggestions_count
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

    if (hangoutRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Hangout not found.' });

      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (hangoutDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });

      return;
    };

    if (!hangoutDetails.is_leader) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Not hangout leader.' });

      return;
    };

    if (hangoutDetails.is_concluded) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Hangout is already concluded.' });

      return;
    };

    if (hangoutDetails.current_stage === HANGOUT_SUGGESTIONS_STAGE && hangoutDetails.suggestions_count === 0) {
      await connection.rollback();
      res.status(409).json({ success: false, message: `Can't progress the hangout without any suggestions.` });

      return;
    };

    const currentTimestamp: number = Date.now();
    const updatedCurrentStagePeriod: number = currentTimestamp - hangoutDetails.stage_control_timestamp;

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        availability_period = CASE
          WHEN current_stage = ${HANGOUT_AVAILABILITY_STAGE} THEN availability_period = :updatedCurrentStagePeriod
          ELSE availability_period
        END,
        suggestions_period = CASE
          WHEN current_stage = ${HANGOUT_SUGGESTIONS_STAGE} THEN suggestions_period = :updatedCurrentStagePeriod
          ELSE suggestions_period
        END,
        voting_period = CASE
          WHEN current_stage = ${HANGOUT_VOTING_STAGE} THEN voting_period = :updatedCurrentStagePeriod
          ELSE voting_period
        END,
        is_concluded = CASE
          WHEN current_stage = ${HANGOUT_VOTING_STAGE} THEN TRUE
          ELSE is_concluded
        END,
        current_stage = current_stage + 1,
        stage_control_timestamp = :currentTimestamp
      WHERE
        hangout_id = :hangoutId;`,
      { updatedCurrentStagePeriod, currentTimestamp, hangoutId: requestData.hangoutId }
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    interface UpdateHangoutDetails extends RowDataPacket {
      new_conclusion_timestamp: number,
    };

    const [updateHangoutRows] = await connection.execute<UpdateHangoutDetails[]>(
      `SELECT
        (created_on_timestamp + availability_period + suggestions_period + voting_period) AS new_conclusion_timestamp
      FROM
        hangouts
      WHERE
        hangout_id = ?;`,
      [requestData.hangoutId]
    );

    if (updateHangoutRows.length === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    const newConclusionTimestamp: number = updateHangoutRows[0].new_conclusion_timestamp;

    await connection.commit();
    res.json({ success: true, resData: {} });

    await connection.query(
      `DELETE FROM
        availability_slots
      WHERE
        slot_start_timestamp < :newConclusionTimestamp AND
        hangout_id = :hangoutId;

      DELETE FROM
        suggestions
      WHERE
        suggestion_start_timestamp < :newConclusionTimestamp AND
        hangout_id = :hangoutId;`,
      { newConclusionTimestamp, hangoutId: requestData.hangoutId }
    );

    const newConclusionDateAndTime: string = getDateAndTimeString(newConclusionTimestamp);
    const eventDescription: string = `Hangout has been manually progressed, and will now be concluded on ${newConclusionDateAndTime} as a result.`;

    await addHangoutEvent(requestData.hangoutId, eventDescription);

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

hangoutsRouter.delete('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

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
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        account_id,
        guest_id,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        hangout_id = ?;`,
      [requestData.hangoutMemberId, requestData.hangoutId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutMember: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMember[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (!hangoutMember.is_leader) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        hangouts
      WHERE
        hangout_id = ?;`,
      [requestData.hangoutId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.get('/details/hangoutExists', async (req: Request, res: Response) => {
  const hangoutId = req.query.hangoutId;

  if (typeof hangoutId !== 'string' || !hangoutValidation.isValidHangoutId(hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  try {
    interface HangoutDetails extends RowDataPacket {
      encrypted_password: string | null,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        encrypted_password
      FROM
        hangouts
      WHERE
        hangout_id = :hangoutId;`,
      { hangoutId }
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const isPasswordProtected: boolean = Boolean(hangoutRows[0].encrypted_password);

    res.json({
      success: true,
      resData: {
        isPasswordProtected,
      },
    });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.get('/details/initial', async (req: Request, res: Response) => {
  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const hangoutId = req.query.hangoutId;

  if (typeof hangoutId !== 'string') {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.', reason: 'hangoutId' });
    return;
  };

  if (!hangoutValidation.isValidHangoutId(hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.', reason: 'hangoutId' });
    return;
  };

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
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutInfo extends RowDataPacket {
      encrypted_password: string | null,
      members_limit: number,
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
    };

    const [hangoutRows] = await dbPool.execute<HangoutInfo[]>(
      `SELECT
        hangouts.encrypted_password,
        hangouts.members_limit,
        hangout_members.hangout_member_id,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?;`,
      [hangoutId]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutInfo: HangoutInfo = hangoutRows[0];

    const isPasswordProtected: boolean = Boolean(hangoutInfo.encrypted_password);
    const isFull: boolean = hangoutRows.length === hangoutInfo.members_limit;

    const requesterHangoutMemberDetails: HangoutInfo | undefined = hangoutRows.find((member: HangoutInfo) => member[`${authSessionDetails.user_type}_id`] === authSessionDetails.user_id);

    if (!requesterHangoutMemberDetails) {
      res.status(401).json({
        success: false,
        message: 'Not a member of this hangout.',
        reason: 'notMember',
        resData: {
          isPasswordProtected,
          isFull: isPasswordProtected ? null : isFull,
        },
      });

      return;
    };

    type HangoutData = [
      HangoutsDetails[],
      HangoutMember[],
      HangoutMemberCountables[],
      HangoutMessage[],
      HangoutEvent[],
    ];

    const [hangoutData] = await dbPool.query<HangoutData>(
      `SELECT
        hangout_title,
        members_limit,
        availability_period,
        suggestions_period,
        voting_period,
        current_stage,
        stage_control_timestamp,
        created_on_timestamp,
        is_concluded
      FROM
        hangouts
      WHERE
        hangout_id = :hangoutId;

      SELECT
        hangout_member_id,
        user_type,
        display_name,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id = :hangoutId;

      SELECT
        COUNT(DISTINCT availability_slots.availability_slot_id) AS availability_slots_count,
        COUNT(DISTINCT suggestions.suggestion_id) AS suggestions_count,
        COUNT(DISTINCT votes.vote_id) AS votes_count
      FROM
        availability_slots
      LEFT JOIN
        suggestions ON availability_slots.hangout_member_id = suggestions.hangout_member_id
      LEFT JOIN
        votes ON suggestions.hangout_member_id = votes.hangout_member_id
      WHERE
        availability_slots.hangout_member_id = :hangoutMemberId
      LIMIT 1;
      
      SELECT
        message_id,
        hangout_member_id,
        message_content,
        message_timestamp
      FROM
        chat
      WHERE
        hangout_id = :hangoutId
      ORDER BY
        message_timestamp DESC
      LIMIT 2;
      
      SELECT
        event_description,
        event_timestamp
      FROM
        hangout_events
      WHERE
        hangout_id = :hangoutId
      ORDER BY
        event_timestamp DESC
      LIMIT 2;`,
      { hangoutId, hangoutMemberId: requesterHangoutMemberDetails.hangout_member_id }
    );

    if (hangoutData.length !== 5) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    const hangoutDetails: HangoutsDetails = hangoutData[0][0];
    const hangoutMembers: HangoutMember[] = hangoutData[1];
    const hangoutMemberCountables: HangoutMemberCountables = hangoutData[2][0];
    const latestHangoutChats: HangoutMessage[] = hangoutData[3];
    const latestHangoutEvents: HangoutEvent[] = hangoutData[4];

    let decryptedHangoutPassword: string | null = null;
    if (hangoutInfo.encrypted_password && requesterHangoutMemberDetails.is_leader) {
      decryptedHangoutPassword = decryptPassword(hangoutInfo.encrypted_password);
    };

    res.json({
      success: true,
      resData: {
        hangoutMemberId: requesterHangoutMemberDetails.hangout_member_id,
        isLeader: requesterHangoutMemberDetails.is_leader,
        isPasswordProtected,
        decryptedHangoutPassword,

        hangoutDetails,
        hangoutMembers,
        hangoutMemberCountables,
        latestHangoutChats,
        latestHangoutEvents,
      },
    });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});