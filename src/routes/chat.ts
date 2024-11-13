import express, { Router, Request, Response } from 'express';
import { isValidAuthToken } from '../util/validation/userValidation';
import { getUserId, getUserType } from '../util/userUtils';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { isValidHangoutId } from '../util/validation/hangoutValidation';
import { isValidMessageContent } from '../util/validation/chatValidation';
import { dbPool } from '../db/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { generatePlaceHolders } from '../util/generatePlaceHolders';

export const chatRouter: Router = express.Router();

chatRouter.post('/add', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutMemberId: number,
    messageContent: string,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthToken(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userId: number = getUserId(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutMemberId', 'messageContent'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member Id', reason: 'hangoutMemberId' });
    return;
  };

  if (!isValidMessageContent(requestData.messageContent)) {
    res.status(400).json({ success: false, message: 'Invalid message content', reason: 'messageContent' });
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
      [userId]
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
      hangout_id: string,
      display_name: string,
    };

    const [hangoutRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        hangout_id,
        display_name
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        ${userType}_id = ?;`,
      [requestData.hangoutMemberId, userId]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutMember: HangoutMember = hangoutRows[0];
    const messageTimestamp: number = Date.now();

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `INSERT INTO chat(
        hangout_member_id,
        hangout_id,
        message_content,
        message_timestamp
      )
      VALUES(${generatePlaceHolders(4)});`,
      [requestData.hangoutMemberId, hangoutMember.hangout_id, requestData.messageContent, messageTimestamp]
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
      hangoutId: hangoutMember.hangout_id,
      messageContent: requestData.messageContent,
      messageTimestamp,
    };

    res.status(201).json({ success: true, resData: { chatMessage } });

    // TODO: websocket logic

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

chatRouter.post('/retrieve', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    messageOffset: number,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthToken(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userId: number = getUserId(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'messageOffset'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.', reason: 'hangoutId' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.', reason: 'hangoutMemberId' });
    return;
  };

  if (!Number.isInteger(requestData.messageOffset)) {
    res.status(400).json({ success: false, message: 'Invalid messages offset.', reason: 'messageOffset' });
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
      [userId]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const [hangoutRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
        1
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        ${userType}_id = ? AND
        hangout_id = ?;`,
      [requestData.hangoutMemberId, userId, requestData.hangoutId]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
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

    res.json({ success: true, chatMessages: chatRows })

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});