import { dbPool } from "../db/db";
import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { isValidPasswordString, isValidUsernameString } from "../util/validation/userValidation";

export const guestsRouter: Router = express.Router();

guestsRouter.post('/signIn', async (req: Request, res: Response) => {
  interface RequestData {
    username: string,
    password: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['username', 'password'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidUsernameString(requestData.username)) {
    res.status(400).json({ success: false, message: 'Invalid username.' });
    return;
  };

  if (!isValidPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        auth_token,
        hangout_id,
        hashed_password
      FROM
        Guests
      WHERE
        username = ?
      LIMIT 1;`
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Guest account not found.' });
      return;
    };

    interface GuestDetails {
      authToken: string,
      hangoutID: string,
      hashedPassword: string,
    };

    const guestDetails: GuestDetails = {
      authToken: rows[0].auth_token,
      hangoutID: rows[0].hangout_id,
      hashedPassword: rows[0].hashed_password,
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, guestDetails.hashedPassword);
    if (!isCorrectPassword) {
      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    res.json({ success: true, resData: { authToken: guestDetails.authToken, hangoutID: guestDetails.hangoutID } })

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});