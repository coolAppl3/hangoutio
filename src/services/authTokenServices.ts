import { dbPool } from "../db/db";
import { Response } from "express";

export async function validateAuthToken(res: Response, authToken: string): Promise<boolean> {
  let tableName: string = '';

  if (authToken.startsWith('a')) {
    tableName = 'Accounts';
  };

  if (authToken.startsWith('g')) {
    tableName = 'Guests';
  };

  if (tableName === '') {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return false;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT auth_token FROM ${tableName}
      WHERE auth_token = ?
      LIMIT 1;`,
      [authToken]
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return false;
    };

    return true;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return false;
  };
};

export async function validateHangoutMemberAuthToken(res: Response, authToken: string, hangoutMemberID: number): Promise<boolean> {
  if (!Number.isInteger(hangoutMemberID)) {
    return false;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT auth_token FROM HangoutMembers
      WHERE hangout_member_id = ?
      LIMIT 1;`,
      [hangoutMemberID]
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return false;
    };

    const memberAuthToken: string = rows[0].auth_token;

    if (memberAuthToken !== authToken) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return false;
    };

    return true;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return false;
  };
};