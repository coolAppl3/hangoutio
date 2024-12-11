import { dbPool } from '../db/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import * as hangoutValidation from '../util/validation/hangoutValidation';
import * as hangoutUtils from '../util/hangoutUtils';
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
import { HANGOUT_SUGGESTIONS_STEP, HANGOUT_VOTING_STEP, ONGOING_HANGOUTS_LIMIT } from '../util/constants';

export const hangoutsRouter: Router = express.Router();

hangoutsRouter.post('/create/accountLeader', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutTitle: string,
    hangoutPassword: string | null,
    memberLimit: number,
    availabilityStep: number,
    suggestionsStep: number,
    votingStep: number,
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

  const expectedKeys: string[] = ['hangoutTitle', 'hangoutPassword', 'memberLimit', 'availabilityStep', 'suggestionsStep', 'votingStep'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutTitle(requestData.hangoutTitle)) {
    res.status(400).json({ success: false, message: 'Invalid hangout title.', reason: 'hangoutTitle' });
    return;
  };

  if (requestData.hangoutPassword !== null && !isValidNewPassword(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.', reason: 'hangoutPassword' });
    return;
  };

  if (!hangoutValidation.isValidHangoutMemberLimit(requestData.memberLimit)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member limit.', reason: 'memberLimit' });
    return;
  };

  const { availabilityStep, suggestionsStep, votingStep }: RequestData = requestData;
  if (!hangoutValidation.isValidHangoutSteps(1, [availabilityStep, suggestionsStep, votingStep])) {
    res.status(400).json({ success: false, message: 'Invalid hangout steps duration.', reason: 'hangoutSteps' });
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
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        display_name
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [authSessionDetails.user_id]
    );

    if (accountRows.length === 0) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    const displayName: string = accountRows[0].display_name;

    interface OngoingHangoutsDetails extends RowDataPacket {
      ongoing_hangouts_count: number,
    };

    const [ongoingHangoutsRows] = await dbPool.execute<OngoingHangoutsDetails[]>(
      `SELECT
        COUNT(*) AS ongoing_hangouts_count
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.is_concluded = ? AND
        hangout_members.account_id = ?
      LIMIT ${ONGOING_HANGOUTS_LIMIT};`,
      [false, authSessionDetails.user_id]
    );

    const ongoingHangoutsCount: number = ongoingHangoutsRows[0].ongoing_hangouts_count;
    if (ongoingHangoutsCount === ONGOING_HANGOUTS_LIMIT) {
      res.status(409).json({
        success: false,
        message: `You've reached the limit of ${ONGOING_HANGOUTS_LIMIT} ongoing hangouts.`,
        reason: 'hangoutsLimitReached',
      });

      return;
    };

    const createdOnTimestamp: number = Date.now();
    const hangoutId: string = generateHangoutId(createdOnTimestamp);

    const encryptedPassword: string | null = requestData.hangoutPassword ? encryptPassword(requestData.hangoutPassword) : null;

    const nextStepTimestamp: number = createdOnTimestamp + availabilityStep;
    const conclusionTimestamp: number = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO hangouts (
        hangout_id,
        hangout_title,
        encrypted_password,
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
      ) VALUES (${generatePlaceHolders(13)});`,
      [hangoutId, requestData.hangoutTitle, encryptedPassword, requestData.memberLimit, availabilityStep, suggestionsStep, votingStep, 1, createdOnTimestamp, nextStepTimestamp, createdOnTimestamp, conclusionTimestamp, false]
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
      [hangoutId, 'account', authSessionDetails.user_id, null, displayName, true]
    );

    await connection.commit();
    res.status(201).json({ success: true, resData: { hangoutId } });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

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
    memberLimit: number,
    availabilityStep: number,
    suggestionsStep: number,
    votingStep: number,
    username: string,
    password: string,
    displayName: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutTitle', 'hangoutPassword', 'memberLimit', 'availabilityStep', 'suggestionsStep', 'votingStep', 'username', 'password', 'displayName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!hangoutValidation.isValidHangoutTitle(requestData.hangoutTitle)) {
    res.status(400).json({ success: false, message: 'Invalid hangout title.', reason: 'hangoutTitle' });
    return;
  };

  if (requestData.hangoutPassword !== null && !isValidNewPassword(requestData.hangoutPassword)) {
    res.status(400).json({ success: false, message: 'Invalid hangout password.', reason: 'hangoutPassword' });
    return;
  };

  if (!hangoutValidation.isValidHangoutMemberLimit(requestData.memberLimit)) {
    res.status(400).json({ success: false, message: 'Invalid member limit.', reason: 'memberLimit' });
    return;
  };

  const { availabilityStep, suggestionsStep, votingStep }: RequestData = requestData;
  if (!hangoutValidation.isValidHangoutSteps(1, [availabilityStep, suggestionsStep, votingStep])) {
    res.status(400).json({ success: false, message: 'Invalid hangout steps duration.', reason: 'hangoutSteps' });
    return;
  };

  if (!isValidDisplayName(requestData.displayName)) {
    res.status(400).json({ success: false, message: 'Invalid guest display name.', reason: 'guestDisplayName' });
    return;
  };

  if (!isValidUsername(requestData.username)) {
    res.status(400).json({ success: false, message: 'Invalid guest username.', reason: 'username' });
    return;
  };

  if (!isValidNewPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid guest password.', reason: 'guestPassword' });
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
      res.status(409).json({ success: false, message: 'Username already taken.', reason: 'guestUsernameTaken' });

      return;
    };

    const createdOnTimestamp: number = Date.now();
    const hangoutId: string = generateHangoutId(createdOnTimestamp);

    const encryptedPassword: string | null = requestData.hangoutPassword ? encryptPassword(requestData.hangoutPassword) : null;

    const nextStepTimestamp: number = createdOnTimestamp + availabilityStep;
    const conclusionTimestamp: number = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;

    await connection.execute(
      `INSERT INTO hangouts (
        hangout_id,
        hangout_title,
        encrypted_password,
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
      ) VALUES (${generatePlaceHolders(13)});`,
      [hangoutId, requestData.hangoutTitle, encryptedPassword, requestData.memberLimit, availabilityStep, suggestionsStep, votingStep, 1, createdOnTimestamp, nextStepTimestamp, createdOnTimestamp, conclusionTimestamp, false]
    );

    const hashedGuestPassword: string = await bcrypt.hash(requestData.password, 10);
    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO guests (
        username,
        hashed_password,
        display_name,
        hangout_id
      ) VALUES (${generatePlaceHolders(5)});`,
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
      const hourMilliseconds: number = 1000 * 60 * 60;
      setResponseCookie(res, 'guestHangoutId', hangoutId, hourMilliseconds * 6, false);
    };

    res.status(201).json({ success: true, resData: { authSessionCreated, hangoutId } });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

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
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangout_id,
        account_id,
        guest_id,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
      [requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails.hangout_id !== requestData.hangoutId) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (!hangoutMemberDetails.is_leader) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
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
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.patch('/details/changeMemberLimit', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    newLimit: number,
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

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'newLimit'];
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

  if (!hangoutValidation.isValidHangoutMemberLimit(requestData.newLimit)) {
    res.status(409).json({ success: false, message: 'Invalid new member limit.' });
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
      member_limit: number,
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
      current_member_count: number,
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
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

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

    if (hangoutDetails.member_limit === requestData.newLimit) {
      await connection.rollback();
      res.status(409).json({ success: false, message: `Hangout already has this member limit.` });

      return;
    };

    if (requestData.newLimit < hangoutDetails.current_member_count) {
      await connection.rollback();
      res.status(409).json({ success: false, message: `New member limit can't be lower than the number of existing members.` });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        member_limit = ?
      WHERE
        hangout_id = ?;`,
      [requestData.newLimit, requestData.hangoutId]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: {} });

    const eventDescription: string = `Hangout member limit was changed to ${requestData.newLimit}.`;
    await addHangoutEvent(requestData.hangoutId, eventDescription);

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

hangoutsRouter.patch('/details/steps/update', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    newAvailabilityStep: number,
    newSuggestionsStep: number,
    newVotingStep: number,
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

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'newAvailabilityStep', 'newSuggestionsStep', 'newVotingStep'];
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

  if (
    !hangoutValidation.isValidHangoutStep(requestData.newAvailabilityStep) ||
    !hangoutValidation.isValidHangoutStep(requestData.newSuggestionsStep) ||
    !hangoutValidation.isValidHangoutStep(requestData.newVotingStep)
  ) {
    res.status(400).json({ success: false, message: 'Invalid hangout steps.' });
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

    const [hangoutRows] = await connection.execute<HangoutDetails[]>(
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
      res.status(404).json({ success: false, message: `Hangout not found.` });

      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (hangoutDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    if (!hangoutDetails.is_leader) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Not hangout leader.' });

      return;
    };

    if (hangoutDetails.is_concluded) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Hangout already concluded.' });

      return;
    };

    const { newAvailabilityStep, newSuggestionsStep, newVotingStep }: RequestData = requestData;
    if (!hangoutValidation.isValidHangoutSteps(hangoutDetails.current_step, [newAvailabilityStep, newSuggestionsStep, newVotingStep])) {
      await connection.rollback();
      res.status(400).json({ success: false, message: 'Invalid mew hangout steps.' });

      return;
    };

    interface NewSteps {
      newAvailabilityStep: number,
      newSuggestionsStep: number,
      newVotingStep: number,
    };

    const newSteps: NewSteps = {
      newAvailabilityStep,
      newSuggestionsStep,
      newVotingStep,
    };

    if (!hangoutValidation.isValidNewHangoutSteps(hangoutDetails, newSteps)) {
      await connection.rollback();
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

    const [firstResultSetHeader] = await connection.execute<ResultSetHeader>(
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
      [newAvailabilityStep, newSuggestionsStep, newVotingStep, newNextStepTimestamp, newConclusionTimestamp, requestData.hangoutId]
    );

    if (firstResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    const yearMilliseconds: number = 1000 * 60 * 60 * 24 * 365;

    const [secondResultSetHeader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        availability_slots
      WHERE
        hangout_id = ? AND
        (slot_start_timestamp < ? OR slot_start_timestamp > ?);`,
      [requestData.hangoutId, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]
    );

    const [thirdResultSetheader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        hangout_id = ? AND
        (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`,
      [requestData.hangoutId, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]
    );

    const deletedAvailabilitySlots: number = secondResultSetHeader.affectedRows;
    const deletedSuggestions: number = thirdResultSetheader.affectedRows;

    await connection.commit();
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

    const eventDescription: string = `Hangout steps have been updated and will now be concluded on ${getDateAndTimeString(newConclusionTimestamp)} as a result. ${deletedAvailabilitySlots || 'No'} availability slots and ${deletedSuggestions || 'no'} suggestions were deleted with this change.`;
    await addHangoutEvent(requestData.hangoutId, eventDescription);

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

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
      suggestions_count: number,
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
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (hangoutDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (!hangoutDetails.is_leader) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
      return;
    };

    if (hangoutDetails.is_concluded) {
      res.status(409).json({ success: false, message: 'Hangout already concluded.' });
      return;
    };

    if (hangoutDetails.current_step === HANGOUT_SUGGESTIONS_STEP && hangoutDetails.suggestions_count === 0) {
      res.status(409).json({ success: false, message: `Can't progress hangout without any suggestions.` });
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

    if (hangoutDetails.current_step === HANGOUT_VOTING_STEP) {
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
        [availability_step, suggestions_step, voting_step, 4, requestTimestamp, newNextStepTimestamp, requestTimestamp, true, requestData.hangoutId]
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
        [requestData.hangoutId, requestTimestamp, (requestTimestamp + yearMilliseconds)]
      );

      const [thirdResultSetheader] = await dbPool.execute<ResultSetHeader>(
        `DELETE FROM
          suggestions
        WHERE
          hangout_id = ? AND
          (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`,
        [requestData.hangoutId, requestTimestamp, (requestTimestamp + yearMilliseconds)]
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

      const eventDescription: string = `Hangout has been manually progressed and is now concluded. ${deletedAvailabilitySlots || 'No'} availability slots and ${deletedSuggestions || 'no'} suggestions were deleted with this change.`;
      await addHangoutEvent(requestData.hangoutId, eventDescription);

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
      [availability_step, suggestions_step, voting_step, newCurrentStep, requestTimestamp, newNextStepTimestamp, newConclusionTimestamp, false, requestData.hangoutId]
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
      [requestData.hangoutId, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]
    );

    const [thirdResultSetheader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        hangout_id = ? AND
        (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`,
      [requestData.hangoutId, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]
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

    const eventDescription: string = `Hangout has been manually progressed, and will now be concluded on ${getDateAndTimeString(newConclusionTimestamp)} as a result. ${deletedAvailabilitySlots || 'No'} availability slots and ${deletedSuggestions || 'no'} suggestions were deleted with this change.`;
    await addHangoutEvent(requestData.hangoutId, eventDescription);

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
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

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
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
      member_limit: number,
      member_count: number,
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
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

hangoutsRouter.get('/details/dashboard', async (req: Request, res: Response) => {
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
        session_id = ?:`,
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
      member_limit: number,
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
    };

    const [hangoutRows] = await dbPool.execute<HangoutInfo[]>(
      `SELECT
        hangouts.encrypted_password,
        hangouts.member_limit,
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
    const isFull: boolean = hangoutRows.length === hangoutInfo.member_limit;

    const requesterHangoutMember: HangoutInfo | undefined = hangoutRows.find((member: HangoutInfo) => member[`${authSessionDetails.user_type}_id`] === authSessionDetails.user_id);

    if (!requesterHangoutMember) {
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
      hangoutUtils.HangoutsDetails[],
      hangoutUtils.HangoutEvent[],
      hangoutUtils.HangoutMember[],
      hangoutUtils.HangoutMemberCountables[],
      hangoutUtils.HangoutChat[],
    ];

    const [hangoutData] = await dbPool.query<HangoutData>(
      `SELECT
        hangout_title,
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
      FROM
        hangouts
      WHERE
        hangout_id = :hangoutId;

      SELECT
        event_description,
        event_timestamp
      FROM
        hangout_events
      WHERE
        hangout_id = :hangoutId
      ORDER BY
        event_timestamp DESC
      LIMIT 2;

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
      LIMIT 2;`,
      { hangoutId, hangoutMemberId: requesterHangoutMember.hangout_member_id }
    );

    if (hangoutData.length !== 5) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    const hangoutDetails: hangoutUtils.HangoutsDetails = hangoutData[0][0];
    const hangoutEvents: hangoutUtils.HangoutEvent[] = hangoutData[1];
    const hangoutMembers: hangoutUtils.HangoutMember[] = hangoutData[2];
    const hangoutMemberCountables: hangoutUtils.HangoutMemberCountables = hangoutData[3][0];
    const hangoutChats: hangoutUtils.HangoutChat[] = hangoutData[4];

    let decryptedHangoutPassword: string | null = null;
    if (hangoutDetails.encrypted_password && requesterHangoutMember.is_leader) {
      decryptedHangoutPassword = decryptPassword(hangoutDetails.encrypted_password);
    };

    res.json({
      success: true,
      resData: {
        hangoutMemberId: requesterHangoutMember.hangout_member_id,
        isLeader: requesterHangoutMember.is_leader,
        isPasswordProtected,
        decryptedHangoutPassword,

        hangoutDetails,
        hangoutEvents,
        hangoutMembers,
        hangoutMemberCountables,
        hangoutChats,
      },
    });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});