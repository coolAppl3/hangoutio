import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';

import { isValidName, isValidPassword } from '../util/validation/userValidation';
import { generateGuestAuthToken } from '../util/generateAuthToken';
import { isValidHangoutID } from '../util/validation/hangoutValidation';
import { hashPassword } from '../util/passwordHash';

export const guestsRouter: Router = express.Router();

interface ResponseData {
  status: number,
  json: { success: boolean, resData: any } | { success: boolean, message: string },
};

interface CreateGuest {
  guestName: string,
  password: string,
  hangoutID: string,
};

guestsRouter.post('/', async (req: Request, res: Response) => {
  const requestData: CreateGuest = req.body;

  if (!isValidName(requestData.guestName)) {
    res.status(400).json({ success: false, message: 'Invalid guest name.' });
    return;
  };

  if (!isValidPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  if (!isValidHangoutID(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  const hashedPassword: string = await hashPassword(requestData.password);

  if (hashPassword.length === 0) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
    return;
  };

  const { status, json }: ResponseData = await createGuest(requestData, hashedPassword);
  res.status(status).json(json);
});

async function createGuest(requestData: CreateGuest, hashedPassword: string, attemptNumber: number = 1): Promise<ResponseData> {
  const authToken = generateGuestAuthToken();

  if (attemptNumber > 3) {
    return { status: 500, json: { success: false, message: 'Something went wrong.' } };
  };

  try {
    const [insertData]: any = await dbPool.execute(
      `INSERT INTO Guests(auth_token, guest_name, password_hash, hangout_id)
      VALUES(?, ?, ?, ?)`,
      [authToken, requestData.guestName, hashedPassword, requestData.hangoutID]
    );

    const guestID: number = insertData.insertId;
    return { status: 200, json: { success: true, resData: { guestID, authToken } } };

  } catch (err: any) {
    console.log(err);

    if (err.errno === 1452) { // hangout ID doesn't exist
      return { status: 400, json: { success: false, message: 'Hangout ID does not exist.' } };
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await createGuest(requestData, hashedPassword, attemptNumber++);
    };

    return { status: 500, json: { success: false, message: 'Something went wrong.' } };
  };
};