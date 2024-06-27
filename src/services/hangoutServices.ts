import { dbPool } from "../db/db";
import { Response } from "express";

export async function validateHangoutID(res: Response, hangoutID: string): Promise<boolean> {
  try {
    const [rows]: any = await dbPool.execute(
      `SELECT hangout_id FROM Hangouts
      WHERE hangout_id = ?`,
      [hangoutID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return false;
    };

    return true;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return false;
  };
};

export async function hangoutLeaderExists(res: Response, hangoutID: string): Promise<boolean> {
  try {
    const [rows]: any = await dbPool.execute(
      `SELECT hangout_member_id FROM HangoutMembers
      WHERE hangout_id = ? AND is_leader = TRUE`,
      [hangoutID]
    );

    if (rows.length > 0) {
      res.status(409).json({ success: false, message: 'Hangout already has a leader.' });
      return true;
    };

    return false;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return true;
  };
};

export async function getHangoutMemberLimit(res: Response, hangoutID: string): Promise<number> {
  try {
    const [rows]: any = await dbPool.execute(
      `SELECT member_limit FROM Hangouts
      WHERE hangout_id = ?;`,
      [hangoutID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return 0;
    };

    const hangoutMemberLimit: number = rows[0].member_limit;
    return hangoutMemberLimit;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return 0;
  };
};

export async function getHangoutCapacity(res: Response, hangoutID: string, hangoutMemberLimit: number): Promise<boolean> {
  try {
    const [rows]: any = await dbPool.execute(
      `SELECT hangout_member_id FROM HangoutMembers
      WHERE hangout_id = ?;`,
      [hangoutID]
    );

    if (rows.length >= hangoutMemberLimit) {
      res.status(403).json({ success: false, message: 'Hangout is full.' });
      return true;
    };

    return false;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return true;
  };
};