import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import generateHangoutId from '../util/generateHangoutID';
import { isValidHangoutConfiguration, isValidHangoutMemberLimit } from '../util/validation/hangoutValidation';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { generatePlaceHolders } from '../util/generatePlaceHolders';

export const hangoutsRouter: Router = express.Router();

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

  await createHangout(res, requestData);
});

async function createHangout(res: Response, requestData: CreateHangout, attemptNumber: number = 0): Promise<void> {
  const hangoutID: string = generateHangoutId();

  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return;
  };

  try {
    await dbPool.execute(
      `INSERT INTO Hangouts(
        hangout_id,
        approve_members,
        member_limit,
        availability_period,
        suggestions_period,
        voting_period,
        current_step,
        created_on_timestamp,
        completed_on_timestamp
      )
      VALUES(${generatePlaceHolders(9)});`,
      [hangoutID, requestData.approveMembers, requestData.memberLimit, requestData.availabilityPeriod, requestData.suggestionsPeriod, requestData.votingPeriod, 1, Date.now(), null]
    );

    res.json({ success: true, resData: { hangoutID } });
    return;

  } catch (err: any) {
    console.log(err)

    if (err.errno === 1062) {
      return await createHangout(res, requestData, ++attemptNumber);
    };

    if (err.errno === 4025) {
      res.status(400).json({ success: false, message: 'Invalid step value.' });
      return;
    };

    if (!err.errno) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
};