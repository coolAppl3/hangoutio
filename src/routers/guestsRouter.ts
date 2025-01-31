import { dbPool } from "../db/db";
import { RowDataPacket } from "mysql2";
import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { isValidPassword, isValidUsername } from "../util/validation/userValidation";
import { createAuthSession } from "../auth/authSessions";
import { setResponseCookie } from "../util/cookieUtils";
import { hourMilliseconds } from "../util/constants";

export const guestsRouter: Router = express.Router();

guestsRouter.post('/signIn', async (req: Request, res: Response) => {
  interface RequestData {
    username: string,
    password: string,
    keepSignedIn: boolean,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['username', 'password'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!isValidUsername(requestData.username)) {
    res.status(400).json({ message: 'Invalid username.', reason: 'invalidUsername' });
    return;
  };

  if (!isValidPassword(requestData.password)) {
    res.status(400).json({ message: 'Invalid password.', reason: 'invalidPassword' });
    return;
  };

  if (typeof requestData.keepSignedIn !== 'boolean') {
    requestData.keepSignedIn = false;
  };

  try {
    interface GuestDetails extends RowDataPacket {
      guest_id: number,
      hangout_id: string,
      hashed_password: string,
    };

    const [guestRows] = await dbPool.execute<GuestDetails[]>(
      `SELECT
        guest_id,
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
      res.status(404).json({ message: 'Guest account not found.' });
      return;
    };

    const guestDetails: GuestDetails = guestRows[0];

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, guestDetails.hashed_password);
    if (!isCorrectPassword) {
      res.status(401).json({ message: 'Incorrect password.' });
      return;
    };

    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: guestDetails.guest_id,
      user_type: 'guest',
      keepSignedIn: requestData.keepSignedIn,
    });

    if (!authSessionCreated) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    const guestHangoutIdCookieMaxAge: number = requestData.keepSignedIn ? hourMilliseconds * 24 * 7 : hourMilliseconds * 6

    setResponseCookie(res, 'guestHangoutId', guestDetails.hangout_id, guestHangoutIdCookieMaxAge, false);
    res.json({});

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});