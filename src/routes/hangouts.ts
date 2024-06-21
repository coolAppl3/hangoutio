import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import generateHangoutId from '../util/generateHangoutID';
import { isValidHangoutConfiguration } from '../util/validation/hangoutValidation';

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
};

hangoutsRouter.post('/', async (req: Request, res: Response) => {
  const requestData: CreateHangout = req.body;

  if (!isValidHangoutConfiguration(requestData.availabilityPeriod, requestData.suggestionsPeriod, requestData.votingPeriod)) {
    res.status(400).json({ success: false, message: 'Invalid hangout data.' });
    return;
  };

  const { status, json }: ResponseData = await createHangout(requestData);
  res.status(status).json(json);
});

async function createHangout(requestData: CreateHangout, attemptNumber: number = 0): Promise<ResponseData> {
  const hangoutID: string = generateHangoutId();

  if (attemptNumber > 3) {
    return { status: 500, json: { success: false, message: 'Something went wrong.' } };
  };

  try {
    await dbPool.execute(
      `INSERT INTO Hangouts(hangout_id, approve_members, availability_period, suggestions_period, voting_period, current_step, created_on_timestamp, completed_on_timestamp)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [hangoutID, Boolean(requestData.approveMembers), Math.floor(requestData.availabilityPeriod), Math.floor(requestData.suggestionsPeriod), Math.floor(requestData.votingPeriod), 1, Date.now(), null]
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

    return { status: 500, json: { success: false, message: 'Something went wrong.' } };
  };
};