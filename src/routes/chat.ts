import express, { Router, Request, Response } from 'express';
import { isValidAuthToken } from '../util/validation/userValidation';
import { getUserID, getUserType } from '../util/userUtils';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { isValidHangoutID } from '../util/validation/hangoutValidation';
import { isValidMessageContent } from '../util/validation/chatValidation';
import { dbPool } from '../db/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { generatePlaceHolders } from '../util/generatePlaceHolders';

export const chatRouter: Router = express.Router();

chatRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutMemberID: number,
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

  const userID: number = getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutID', 'hangoutMemberID', 'messageContent'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutID(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID', reason: 'hangoutID' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID', reason: 'hangoutMemberID' });
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

    const [hangoutRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
        1
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        ${userType}_id = ? AND
        hangout_id = ?;`,
      [requestData.hangoutMemberID, userID, requestData.hangoutID]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const messageTimestamp: number = Date.now();

    await dbPool.execute<ResultSetHeader>(
      `INSERT INTO chat(
        hangout_member_id,
        hangout_id,
        message_content,
        message_timestamp
      )
      VALUES(${generatePlaceHolders(4)});`,
      [requestData.hangoutMemberID, requestData.hangoutID, requestData.messageContent, messageTimestamp]
    );

    res.status(201).json({ success: true, resData: {} });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});