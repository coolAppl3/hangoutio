import { dbPool } from "../db/db";
import express, { Router, Request, Response } from 'express';
import { isValidHangoutIDString } from '../util/validation/hangoutValidation';
import { getHangoutCapacity, getHangoutMemberLimit, hangoutLeaderExists, validateHangoutID } from '../services/hangoutServices';
import { validateAuthToken } from '../services/authTokenServices';
import { isValidAuthTokenString } from '../util/validation/userValidation';
import { undefinedValuesDetected } from "../util/validation/requestValidation";

export const hangoutMembersRouter: Router = express.Router();

hangoutMembersRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    authToken: string,
    isLeader: boolean,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutID', 'authToken', 'isLeader'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!isValidAuthTokenString(requestData.authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const isValidHangoutID: boolean = await validateHangoutID(res, requestData.hangoutID);
  if (!isValidHangoutID) {
    return;
  };

  const isValidAuthToken: boolean = await validateAuthToken(res, requestData.authToken);
  if (!isValidAuthToken) {
    return;
  };

  if (requestData.isLeader) {
    const leaderExists: boolean = await hangoutLeaderExists(res, requestData.hangoutID);
    if (leaderExists) {
      return;
    };
  };

  const hangoutMemberLimit: number = await getHangoutMemberLimit(res, requestData.hangoutID);
  if (hangoutMemberLimit === 0) {
    return;
  };

  const hangoutIsFull: boolean = await getHangoutCapacity(res, requestData.hangoutID, hangoutMemberLimit);
  if (hangoutIsFull) {
    return;
  };

  try {
    const [insertData]: any = await dbPool.execute(
      `INSERT INTO HangoutMembers(hangout_id, auth_token, is_leader)
      VALUES(?, ?, ?);`,
      [requestData.hangoutID, requestData.authToken, requestData.isLeader]
    );

    const hangoutMemberID: string = insertData.insertId;
    res.json({ success: true, resData: { hangoutMemberID } });

  } catch (err: any) {
    console.log(err);

    if (err.errno === 1452) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    if (err.errno === 1062) {
      res.status(400).json({ success: false, message: 'You are already a member in this session.' });
      return;
    };

    if (!err.errno) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});