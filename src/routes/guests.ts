import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';

import { isValidName, isValidPassword } from '../util/validation/userValidation';
import { generateAuthToken } from '../util/authTokens';
import { isValidHangoutIDString } from '../util/validation/hangoutValidation';
import { getHashedPassword } from '../services/passwordServices';
import { undefinedValuesDetected } from '../util/validation/requestValidation';

export const guestsRouter: Router = express.Router();

interface ResponseData {
  status: number,
  json: { success: boolean, resData: any } | { success: boolean, message: string },
};

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

  const { status, json }: ResponseData = await createGuest(requestData, hashedPassword);
  res.status(status).json(json);
});

async function createGuest(requestData: CreateGuest, hashedPassword: string, attemptNumber: number = 1): Promise<ResponseData> {
  const authToken = generateAuthToken('guest');

  if (attemptNumber > 3) {
    return { status: 500, json: { success: false, message: 'Internal server error.' } };
  };

  try {
    const [insertData]: any = await dbPool.execute(
      `INSERT INTO Guests(auth_token, user_name, password_hash, hangout_id)
      VALUES(?, ?, ?, ?);`,
      [authToken, requestData.userName, hashedPassword, requestData.hangoutID]
    );

    const guestID: number = insertData.insertId;
    return { status: 200, json: { success: true, resData: { guestID, authToken } } };

  } catch (err: any) {
    console.log(err);

    if (!err.errno) {
      return { status: 400, json: { success: false, message: 'Invalid request data.' } };
    };

    if (err.errno === 1452) {
      return { status: 400, json: { success: false, message: 'Hangout not found.' } };
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await createGuest(requestData, hashedPassword, attemptNumber++);
    };

    return { status: 500, json: { success: false, message: 'Internal server error.' } };
  };
};