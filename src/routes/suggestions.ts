import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { isValidAuthTokenString } from '../util/validation/userValidation';
import { isValidSuggestionDescription, isValidSuggestionTitle } from '../util/validation/suggestionsValidation';
import { validateHangoutMemberAuthToken } from '../services/authTokenServices';
import { checkSuggestionsLimit } from '../services/suggestionServices';

export const suggestionsRouter: Router = express.Router();

suggestionsRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    authToken: string,
    hangoutMemberID: number,
    suggestionTitle: string,
    suggestionDescription: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['authToken', 'hangoutMemberID', 'suggestionTitle', 'suggestionDescription'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidAuthTokenString(requestData.authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const isValidAuthToken: boolean = await validateHangoutMemberAuthToken(res, requestData.authToken, requestData.hangoutMemberID);
  if (!isValidAuthToken) {
    return;
  };

  if (!isValidSuggestionTitle(requestData.suggestionTitle)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion title.' });
    return;
  };

  if (!isValidSuggestionDescription(requestData.suggestionDescription)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion description.' });
    return;
  };

  const suggestionsLimitReached: boolean = await checkSuggestionsLimit(res, requestData.hangoutMemberID);
  if (suggestionsLimitReached) {
    return;
  };

  try {
    await dbPool.execute(
      `INSERT INTO Suggestions(hangout_member_id, suggestion_title, suggestion_description)
      VALUES(?, ?, ?)`,
      [requestData.hangoutMemberID, requestData.suggestionTitle, requestData.suggestionDescription]
    );

    res.json({ success: true, resData: {} })

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

