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

chatRouter.post('/add', async (req: Request, res: Response) => {
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

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

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

    if (hangoutRows.length === 0) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutRows[0];

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

    res.status(200).json({ chatMessage });

    // TODO: websocket logic

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});

chatRouter.post('/retrieve', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    messageOffset: number,
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

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'messageOffset'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.', reason: 'hangoutId' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.', reason: 'hangoutMemberId' });
    return;
  };

  if (!Number.isInteger(requestData.messageOffset)) {
    res.status(400).json({ message: 'Invalid messages offset.', reason: 'messageOffset' });
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

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

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
      [requestData.hangoutMemberId, authSessionDetails.user_id, requestData.hangoutId]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    interface ChatMessage extends RowDataPacket {
      message_id: number,
      hangout_member_id: number,
      message_content: string,
      message_timestamp: number,
      sender_name: string,
    };

    const [chatRows] = await dbPool.execute<ChatMessage[]>(
      `SELECT
        chat.message_id,
        chat.hangout_member_id,
        chat.message_content,
        chat.message_timestamp,
        hangout_members.display_name as sender_name
      FROM
        chat
      LEFT JOIN
        hangout_members ON chat.hangout_member_id = hangout_members.hangout_member_id
      WHERE
        chat.hangout_id = ?
      ORDER BY
        chat.message_timestamp DESC
      LIMIT 20 OFFSET ?;`,
      [requestData.hangoutId, requestData.messageOffset]
    );

    res.json({ chatMessages: chatRows })

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});