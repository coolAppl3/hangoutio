import { dbPool } from "../db/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { isValidHangoutId } from '../util/validation/hangoutValidation';
import { isValidDisplayName, isValidNewPassword, isValidPassword, isValidUsername } from '../util/validation/userValidation';
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import { addHangoutEvent } from "../util/addHangoutEvent";
import { getRequestCookie, removeRequestCookie, setResponseCookie } from "../util/cookieUtils";
import * as authUtils from '../auth/authUtils';
import { createAuthSession, destroyAuthSession, purgeAuthSessions } from "../auth/authSessions";
import { decryptPassword } from "../util/encryptionUtils";
import { hourMilliseconds, MAX_HANGOUT_MEMBERS_LIMIT, MAX_ONGOING_HANGOUTS_LIMIT } from "../util/constants";

export const hangoutMembersRouter: Router = express.Router();

hangoutMembersRouter.post('/joinHangout/account', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutPassword: string | null,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.', reason: 'invalidHangoutID' });
    return;
  };

  if (requestData.hangoutPassword && !isValidPassword(requestData.hangoutPassword)) {
    res.status(400).json({ message: 'Invalid hangout password', reason: 'invalidHangoutPassword' });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    if (authSessionDetails.user_type === 'guest') {
      res.status(403).json({ message: `Guest accounts can't join more than one hangout.`, reason: 'guestAccount' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    interface UserDetails extends RowDataPacket {
      display_name: string,
      joined_hangouts_counts: number,
    };

    const [userRows] = await connection.execute<UserDetails[]>(
      `SELECT
        display_name,
        (SELECT COUNT(*) FROM hangout_members WHERE account_id = :userId) AS joined_hangouts_count
      FROM
        accounts
      WHERE
        account_id = :userId;`,
      { userId: authSessionDetails.user_id }
    );

    const userDetails: UserDetails | undefined = userRows[0];

    if (!userDetails) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      await connection.rollback();
      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });

      return;
    };

    if (userDetails.joined_hangouts_counts >= MAX_ONGOING_HANGOUTS_LIMIT) {
      await connection.rollback();
      res.status(409).json({
        message: `You've reached the limit of ${MAX_ONGOING_HANGOUTS_LIMIT} ongoing hangouts.`,
        reason: 'hangoutsLimitReached',
      });

      return;
    };

    interface HangoutDetails extends RowDataPacket {
      is_concluded: boolean,
      encrypted_password: string | null,
      members_limit: number,
      member_count: number,
      already_joined: boolean,
    };

    const [hangoutRows] = await connection.execute<HangoutDetails[]>(
      `SELECT
        is_concluded,
        encrypted_password,
        members_limit,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = :hangoutId) AS member_count,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = :hangoutId AND account_id = :userId) AS already_joined
      FROM
        hangouts
      WHERE
        hangout_id = :hangoutId;`,
      { hangoutId: requestData.hangoutId, userId: authSessionDetails.user_id }
    );

    const hangoutDetails: HangoutDetails | undefined = hangoutRows[0];

    if (!hangoutDetails) {
      await connection.rollback();
      res.status(404).json({ message: 'Hangout not found.' });

      return;
    };

    if (hangoutDetails.already_joined) {
      await connection.rollback();
      res.status(409).json({ message: 'Already a member of this hangout.', reason: 'alreadyJoined' });

      return;
    };

    if (hangoutDetails.is_concluded) {
      await connection.rollback();
      res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });

      return;
    };

    if (hangoutDetails.encrypted_password) {
      const isCorrectHangoutPassword: boolean = requestData.hangoutPassword === decryptPassword(hangoutDetails.encrypted_password);

      if (!isCorrectHangoutPassword) {
        await connection.rollback();
        res.status(401).json({ message: 'Incorrect hangout password.', reason: 'hangoutPassword' });

        return;
      };
    };

    const isFull: boolean = hangoutDetails.member_count === hangoutDetails.members_limit;
    if (isFull) {
      await connection.rollback();
      res.status(409).json({ message: 'Hangout full.', reason: 'hangoutFull' });

      return;
    };

    await connection.execute(
      `INSERT INTO hangout_members (
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      ) VALUES (${generatePlaceHolders(6)});`,
      [requestData.hangoutId, 'account', authSessionDetails.user_id, null, userDetails.display_name, false]
    );

    await connection.commit();
    res.json({});

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

hangoutMembersRouter.post('/joinHangout/guest', async (req: Request, res: Response) => {
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
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
    return;
  };

  if (requestData.hangoutPassword && !isValidNewPassword(requestData.hangoutPassword)) {
    res.status(400).json({ message: 'Invalid hangout password.', reason: 'invalidHangoutPassword' });
    return;
  };

  if (!isValidUsername(requestData.username)) {
    res.status(400).json({ message: 'Invalid username.', reason: 'invalidUsername' });
    return;
  };

  if (!isValidNewPassword(requestData.password)) {
    res.status(400).json({ message: 'Invalid user password.', reason: 'invalidUserPassword' });
    return;
  };

  if (requestData.username === requestData.password) {
    res.status(409).json({ message: `Password can't be identical to username.`, reason: 'passwordEqualsUsername' });
    return;
  };

  if (!isValidDisplayName(requestData.displayName)) {
    res.status(400).json({ message: 'Invalid display name.', reason: 'invalidDisplayName' });
    return;
  };

  let connection;

  try {
    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutDetails extends RowDataPacket {
      is_concluded: boolean,
      encrypted_password: string | null,
      members_limit: number,
      member_count: number,
    };

    const [hangoutRows] = await connection.execute<HangoutDetails[]>(
      `SELECT
        is_concluded,
        encrypted_password,
        members_limit,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = :hangoutId) AS member_count
      FROM
        hangouts
      WHERE
        hangout_id = :hangoutId;`,
      { hangoutId: requestData.hangoutId }
    );

    const hangoutDetails: HangoutDetails | undefined = hangoutRows[0];

    if (!hangoutDetails) {
      await connection.rollback();
      res.status(404).json({ message: 'Hangout not found.' });

      return;
    };

    if (hangoutDetails.is_concluded) {
      await connection.rollback();
      res.status(403).json({ message: 'Hangout has already been concluded.' });

      return;
    };

    if (hangoutDetails.encrypted_password) {
      const isCorrectHangoutPassword: boolean = requestData.hangoutPassword === decryptPassword(hangoutDetails.encrypted_password);

      if (!isCorrectHangoutPassword) {
        await connection.rollback();
        res.status(401).json({ message: 'Incorrect hangout password.', reason: 'hangoutPassword' });

        return;
      };
    };

    const isFull: boolean = hangoutDetails.member_count === hangoutDetails.members_limit;
    if (isFull) {
      await connection.rollback();
      res.status(409).json({ message: 'Hangout is full.', reason: 'hangoutFull' });

      return;
    };

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
      res.status(409).json({ message: 'Username already taken.', reason: 'usernameTaken' });

      return;
    };

    const hashedPassword: string = await bcrypt.hash(requestData.password, 10);

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO guests (
        username,
        hashed_password,
        display_name,
        hangout_id
      ) VALUES (${generatePlaceHolders(5)});`,
      [requestData.username, hashedPassword, requestData.displayName, requestData.hangoutId]
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
      [requestData.hangoutId, 'guest', null, guestId, requestData.displayName, false]
    );

    await connection.commit();

    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: guestId,
      user_type: 'guest',
      keepSignedIn: false,
    });

    setResponseCookie(res, 'guestHangoutId', requestData.hangoutId, hourMilliseconds * 6, false);

    res.json({ authSessionCreated });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

hangoutMembersRouter.delete('/kick', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    memberToKickId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'memberToKickId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.memberToKickId)) {
    res.status(400).json({ message: 'Invalid member to kick ID.' });
    return;
  };

  if (requestData.hangoutMemberId === requestData.memberToKickId) {
    res.status(409).json({ message: `You can't kick yourself.` });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
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
      LIMIT ${MAX_HANGOUT_MEMBERS_LIMIT};`,
      [requestData.hangoutId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    const hangoutMember: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member.hangout_member_id === requestData.hangoutMemberId && member[`${authSessionDetails.user_type}_id`] === authSessionDetails.user_id);

    if (!hangoutMember) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (!hangoutMember.is_leader) {
      res.status(401).json({ message: 'Not hangout leader.' });
      return;
    };

    const memberToKick: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member.hangout_member_id === requestData.memberToKickId);
    if (!memberToKick) {
      res.status(404).json({ message: 'Member not found.' });
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
        res.status(500).json({ message: 'Internal server error.' });
        return;
      };

      res.json({});

      const eventDescription: string = `${memberToKick.display_name} was kicked.`;
      await addHangoutEvent(requestData.hangoutId, eventDescription);

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
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    res.json({});

    const eventDescription: string = `${memberToKick.display_name} was kicked.`;
    await addHangoutEvent(requestData.hangoutId, eventDescription);

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});

hangoutMembersRouter.delete('/leave', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutMemberId: number,
    hangoutId: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutMemberId', 'hangoutId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      hangout_id: string,
      account_id: number,
      guest_id: number,
      display_name: string,
      is_leader: boolean,
      hangout_member_count: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangout_id,
        account_id,
        guest_id,
        display_name,
        is_leader,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = ?) AS hangout_member_count
      FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutMemberRows[0];

    if (!hangoutMemberDetails) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    if (hangoutMemberDetails.hangout_id !== requestData.hangoutId) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.hangout_member_count === 1) {
      const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
        `DELETE FROM
          hangouts
        WHERE
          hangout_id = ?;`,
        [requestData.hangoutId]
      );

      if (resultSetHeader.affectedRows === 0) {
        res.status(500).json({ message: 'Internal server error.' });
        return;
      };

      if (authSessionDetails.user_type === 'guest') {
        await purgeAuthSessions(authSessionDetails.user_id, 'guest');
        removeRequestCookie(res, 'authSessionId');
      };

      res.json({});
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
      [requestData.hangoutMemberId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    if (authSessionDetails.user_type === 'guest') {
      await purgeAuthSessions(authSessionDetails.user_id, 'guest');
      removeRequestCookie(res, 'authSessionId');
    };

    res.json({});
    await addHangoutEvent(requestData.hangoutId, `${hangoutMemberDetails.display_name} left the hangout.`);

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});

hangoutMembersRouter.patch('/transferLeadership', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    newLeaderMemberId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'newLeaderMemberId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.newLeaderMemberId)) {
    res.status(400).json({ message: 'Invalid new leader hangout member ID.' });
    return;
  };

  if (requestData.hangoutMemberId === requestData.newLeaderMemberId) {
    res.status(409).json({ message: `You're already hangout leader.` });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
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
      LIMIT ${MAX_HANGOUT_MEMBERS_LIMIT};`,
      [requestData.hangoutId]
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ message: 'Hangout not found.' });

      return;
    };

    const hangoutMember: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member.hangout_member_id === requestData.hangoutMemberId && member[`${authSessionDetails.user_type}_id`] === authSessionDetails.user_id);

    if (!hangoutMember) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      await connection.rollback();
      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });

      return;
    };

    if (!hangoutMember.is_leader) {
      await connection.rollback();
      res.status(401).json({ message: 'Not hangout leader.' });

      return;
    };

    const newHangoutLeader: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member.hangout_member_id === requestData.newLeaderMemberId);
    if (!newHangoutLeader) {
      await connection.rollback();
      res.status(404).json({ message: 'Member not found.' });

      return;
    };

    const [resultSetHeader] = await connection.query<ResultSetHeader>(
      `UPDATE
        hangout_members
      SET
        is_leader = ?
      WHERE
        hangout_member_id = ?;
      
      UPDATE
        hangout_members
      SET
        is_leader = ?
      WHERE
        hangout_member_id = ?;`,
      [false, hangoutMember.hangout_member_id, true, newHangoutLeader.hangout_member_id]
    );

    if (resultSetHeader.affectedRows !== 2) {
      await connection.rollback();
      res.status(500).json({ message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({});

    const eventDescription: string = `${hangoutMember.display_name} transferred hangout leadership to ${newHangoutLeader.display_name}.`;
    await addHangoutEvent(requestData.hangoutId, eventDescription);

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

hangoutMembersRouter.patch('/claimLeadership', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(404).json({ message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutMember extends RowDataPacket {
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
      display_name: string,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMember[]>(
      `SELECT
        hangout_member_id,
        account_id,
        guest_id,
        is_leader,
        display_name
      FROM
        hangout_members
      WHERE
        hangout_id = ?
      LIMIT ${MAX_HANGOUT_MEMBERS_LIMIT};`,
      [requestData.hangoutId]
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ message: 'Hangout not found.' });

      return;
    };

    const hangoutMember: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member.hangout_member_id === requestData.hangoutMemberId && member[`${authSessionDetails.user_type}_id`] === authSessionDetails.user_id);

    if (!hangoutMember) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      await connection.rollback();
      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });

      return;
    };

    const currentHangoutLeader: HangoutMember | undefined = hangoutMemberRows.find((member: HangoutMember) => member.is_leader);
    if (currentHangoutLeader) {
      await connection.rollback();
      res.status(409).json({
        message: hangoutMember.hangout_member_id === currentHangoutLeader.hangout_member_id ? `You're already the hangout leader.` : 'Hangout already has a leader.',
      });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        hangout_members
      SET
        is_leader = ?
      WHERE
        hangout_member_id = ?;`,
      [true, requestData.hangoutMemberId]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({});

    const eventDescription: string = `${hangoutMember.display_name} has claimed the hangout leader role.`;
    await addHangoutEvent(requestData.hangoutId, eventDescription);

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});