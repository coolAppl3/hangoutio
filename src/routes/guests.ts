import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';

import { isValidName, isValidPassword } from '../util/validation/userValidation';
import { generateAuthToken } from '../util/authTokens';
import { isValidHangoutIDString } from '../util/validation/hangoutValidation';
import { getHashedPassword } from '../services/passwordServices';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { generatePlaceHolders } from '../util/generatePlaceHolders';

export const guestsRouter: Router = express.Router();

interface CreateGuest {
  userName: string,
  password: string,
  hangoutID: string,
};

guestsRouter.post('/', async (req: Request, res: Response) => {
  const requestData: CreateGuest = req.body;

  const expectedKeys: string[] = ['userName', 'password', 'hangoutID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidName(requestData.userName)) {
    res.status(400).json({ success: false, message: 'Invalid guest name.' });
    return;
  };

  if (!isValidPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  if (!isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  const hashedPassword: string = await getHashedPassword(res, requestData.password);
  if (hashedPassword === '') {
    return;
  };

  await createGuest(res, requestData, hashedPassword);
});

async function createGuest(res: Response, requestData: CreateGuest, hashedPassword: string, attemptNumber: number = 1): Promise<void> {
  const authToken = generateAuthToken('guest');

  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return;
  };

  try {
    const [insertData]: any = await dbPool.execute(
      `INSERT INTO Guests(
        auth_token,
        user_name,
        password_hash,
        hangout_id
      )
      VALUES(${generatePlaceHolders(4)});`,
      [authToken, requestData.userName, hashedPassword, requestData.hangoutID]
    );

    const guestID: number = insertData.insertId;
    res.json({ success: true, resData: { guestID, authToken } });

  } catch (err: any) {
    console.log(err);

    if (!err.errno) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    if (err.errno === 1452) {
      res.status(404).json({ succesS: false, message: 'Hangout not found.' });
      return;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await createGuest(res, requestData, hashedPassword, ++attemptNumber);
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
};