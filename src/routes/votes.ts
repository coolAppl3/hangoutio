import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { checkVotesLimit, checkForDuplicateVote } from '../services/voteServices';
import { validateHangoutMemberAuthToken } from '../services/authTokenServices';

export const votesRouter: Router = express.Router();

votesRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    authToken: string,
    hangoutMemberID: number,
    suggestionID: number,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['authToken', 'hangoutMemberID', 'suggestionID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID) || !Number.isInteger(requestData.suggestionID)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  const isValidAuthToken: boolean = await validateHangoutMemberAuthToken(res, requestData.authToken, requestData.hangoutMemberID);
  if (!isValidAuthToken) {
    return;
  };

  const isDuplicateVote: boolean = await checkForDuplicateVote(res, requestData.hangoutMemberID, requestData.suggestionID);
  if (isDuplicateVote) {
    return;
  };

  const votesLimitReached: boolean = await checkVotesLimit(res, requestData.hangoutMemberID);
  if (votesLimitReached) {
    return;
  };

  try {
    await dbPool.execute(
      `INSERT INTO Votes(hangout_member_id, suggestion_id)
      VALUES(?, ?)`,
      [requestData.hangoutMemberID, requestData.suggestionID]
    );

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);

    if (err.errno === 1452) {
      res.status(404).json({ success: false, message: 'Suggestion not found.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});