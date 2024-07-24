import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import { isValidTimeSlotsString } from '../util/validation/timeSlotValidation';
import { validateHangoutMemberAuthToken } from '../services/authTokenServices';
import { isValidAuthTokenString } from '../util/validation/userValidation';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { generatePlaceHolders } from '../util/generatePlaceHolders';

export const availabilityRouter: Router = express.Router();

availabilityRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutMemberID: number,
    dateString: string,
    dateTimestamp: number,
    slots: string,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutMemberID', 'dateString', 'dateTimestamp', 'slots'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const isValidAuthToken: boolean = await validateHangoutMemberAuthToken(res, authToken, requestData.hangoutMemberID);
  if (!isValidAuthToken) {
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid user ID.' });
    return;
  };

  if (typeof requestData.dateString !== 'string') {
    res.status(400).json({ success: false, message: 'Invalid date string.' });
  };

  const minimumDateStringLength: number = 11; // "May 1, YYYY"
  if (requestData.dateString.length < minimumDateStringLength) {
    res.status(400).json({ success: false, message: 'Invalid date string.' });
    return;
  };

  if (!Number.isInteger(requestData.dateTimestamp)) {
    res.status(400).json({ success: false, message: 'Invalid date.' });
    return;
  };

  if (!isValidTimeSlotsString(requestData.slots)) {
    res.status(400).json({ success: false, message: 'Invalid time slots.' });
    return;
  };

  try {
    await dbPool.execute(
      `INSERT INTO Availability(
        hangout_member_id,
        date_string,
        date_timestamp,
        slots
      )
      VALUES(${generatePlaceHolders(4)});`,
      [requestData.hangoutMemberID, requestData.dateString, requestData.dateTimestamp, requestData.slots]
    );

    res.json({ success: true, requestData: {} });

  } catch (err: any) {
    console.log(err);

    if (!err.errno) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    if (err.errno === 1062) {
      res.status(409).json({ success: false, message: 'User already has an availability row.' });
      return;
    };

    if (err.errno === 1452) {
      res.status(404).json({ success: false, message: 'Hangout member ID not found.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});