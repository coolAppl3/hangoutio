import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import generateHangoutId from '../util/generateHangoutID';
import { isValidHangoutConfiguration, isValidHangoutMemberLimit } from '../util/validation/hangoutValidation';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { validateAuthToken } from '../services/authTokenServices';
import { isValidAuthTokenString } from '../util/validation/userValidation';

export const hangoutsRouter: Router = express.Router();

interface ResponseData {
  status: number,
  json: { success: boolean, resData: any } | { success: boolean, message: string },
};

interface CreateHangout {
  availabilityPeriod: number,
  suggestionsPeriod: number,
  votingPeriod: number,
  approveMembers: boolean,
  memberLimit: number,
};

hangoutsRouter.post('/', async (req: Request, res: Response) => {
  const requestData: CreateHangout = req.body;

  const expectedKeys: string[] = ['availabilityPeriod', 'suggestionsPeriod', 'votingPeriod', 'approveMembers', 'memberLimit'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  const { availabilityPeriod, suggestionsPeriod, votingPeriod }: CreateHangout = requestData;
  if (!isValidHangoutConfiguration(availabilityPeriod, suggestionsPeriod, votingPeriod)) {
    res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
    return;
  };

  if (typeof requestData.approveMembers !== 'boolean') {
    res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
    return false;
  };

  if (!isValidHangoutMemberLimit(requestData.memberLimit)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member limit.' });
    return;
  };

  const { status, json }: ResponseData = await createHangout(requestData);
  res.status(status).json(json);
});

async function createHangout(requestData: CreateHangout, attemptNumber: number = 0): Promise<ResponseData> {
  const hangoutID: string = generateHangoutId();

  if (attemptNumber > 3) {
    return { status: 500, json: { success: false, message: 'Internal server error.' } };
  };

  try {
    await dbPool.execute(
      `INSERT INTO Hangouts(hangout_id, approve_members, member_limit, availability_period, suggestions_period, voting_period, current_step, created_on_timestamp, completed_on_timestamp)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [hangoutID, requestData.approveMembers, requestData.memberLimit, requestData.availabilityPeriod, requestData.suggestionsPeriod, requestData.votingPeriod, 1, Date.now(), null]
    );

    return { status: 200, json: { success: true, resData: { hangoutID } } };

  } catch (err: any) {
    console.log(err)

    if (err.errno === 1062) {
      return await createHangout(requestData, attemptNumber++);
    };

    if (err.errno === 4025) {
      return { status: 400, json: { success: false, message: 'Invalid step value.' } };
    };

    if (!err.errno) {
      return { status: 400, json: { success: false, message: 'Invalid request data.' } };
    };

    return { status: 500, json: { success: false, message: 'Internal server error.' } };
  };
};