import express, { Router, Request, Response } from 'express';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { isValidHangoutId } from '../util/validation/hangoutValidation';
import { isValidMessageContent } from '../util/validation/chatValidation';
import { dbPool } from '../db/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { generatePlaceHolders } from '../util/generatePlaceHolders';
import * as authUtils from '../auth/authUtils';
import { getRequestCookie, removeRequestCookie } from '../util/cookieUtils';
import { destroyAuthSession } from '../auth/authSessions';

export const chatRouter: Router = express.Router();

chatRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutMemberId: number,
    hangoutId: string,
    messageContent: string,
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

  const expectedKeys: string[] = ['hangoutMemberId', 'messageContent'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member Id', reason: 'hangoutMemberId' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.', reason: 'hangoutId' });
    return;
  };

  if (!isValidMessageContent(requestData.messageContent)) {
    res.status(400).json({ message: 'Invalid message content', reason: 'messageContent' });
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
      { authSessionId }
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
      display_name: string,
    };

    const [hangoutRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangout_id,
        display_name
      FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
      [requestData.hangoutMemberId]
    );

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutRows[0];

    if (!hangoutMemberDetails) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.hangout_id !== requestData.hangoutId) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    const messageTimestamp: number = Date.now();

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO chat (
        hangout_member_id,
        hangout_id,
        message_content,
        message_timestamp
      ) VALUES (${generatePlaceHolders(4)});`,
      [requestData.hangoutMemberId, hangoutMemberDetails.hangout_id, requestData.messageContent, messageTimestamp]
    );

    interface ChatMessage {
      messageId: number,
      hangoutMemberId: number,
      hangoutId: string,
      messageContent: string,
      messageTimestamp: number,
    };

    const chatMessage: ChatMessage = {
      messageId: resultSetHeader.insertId,
      hangoutMemberId: requestData.hangoutMemberId,
      hangoutId: hangoutMemberDetails.hangout_id,
      messageContent: requestData.messageContent,
      messageTimestamp,
    };

    res.status(201).json({ chatMessage });

    // TODO: websocket logic

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});

chatRouter.get('/', async (req: Request, res: Response) => {
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

  const hangoutId = req.query.hangoutId;
  const hangoutMemberId = req.query.hangoutMemberId;
  const messageOffset = req.query.messageOffset;

  if (typeof hangoutId !== 'string' || typeof hangoutMemberId !== 'string' || typeof messageOffset !== 'string') {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(+hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(+messageOffset)) {
    res.status(400).json({ message: 'Invalid messages offset.' });
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
      { authSessionId }
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

    const [hangoutRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
        1 AS hangout_found
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        ${authSessionDetails.user_type}_id = ? AND
        hangout_id = ?;`,
      [+hangoutMemberId, authSessionDetails.user_id, hangoutId]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    const [chatMessages] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
        message_id,
        hangout_member_id,
        message_content,
        message_timestamp,
      FROM
        chat
      WHERE
        hangout_id = ?
      ORDER BY
        message_timestamp DESC
      LIMIT 30 OFFSET ?;`,
      [hangoutId, +messageOffset]
    );

    res.json(chatMessages);

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});