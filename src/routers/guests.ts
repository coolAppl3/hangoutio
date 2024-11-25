import { dbPool } from "../db/db";
import { RowDataPacket } from "mysql2";
import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { isValidPassword, isValidUsername } from "../util/validation/userValidation";

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

  if (!isValidUsername(requestData.username)) {
    res.status(400).json({ success: false, message: 'Invalid username.', reason: 'username' });
    return;
  };

  if (!isValidPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.', reason: 'password' });
    return;
  };

  try {
    interface GuestDetails extends RowDataPacket {
      auth_token: string,
      hangout_id: string,
      hashed_password: string,
    };

    const [guestRows] = await dbPool.execute<GuestDetails[]>(
      `SELECT
        auth_token,
        hangout_id,
        hashed_password
      FROM
        guests
      WHERE
        username = ?
      LIMIT 1;`,
      [requestData.username]
    );

    if (guestRows.length === 0) {
      res.status(404).json({ success: false, message: 'Guest account not found.' });
      return;
    };

    const guestDetails: GuestDetails = guestRows[0];

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, guestDetails.hashed_password);
    if (!isCorrectPassword) {
      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    res.json({ success: true, resData: { authToken: guestDetails.auth_token, hangoutId: guestDetails.hangout_id } });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});