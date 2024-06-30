import { dbPool } from "../db/db";
import { Response } from "express";

export async function checkSuggestionsLimit(res: Response, hangoutMemberID: number): Promise<boolean> {
  try {
    const [rows]: any = await dbPool.execute(
      `SELECT suggestion_id FROM Suggestions
      WHERE hangout_member_id = ?`,
      [hangoutMemberID]
    );

    if (rows.length >= 3) {
      res.status(400).json({ success: false, message: 'Suggestion limit reached.' });
      return true;
    };

    return false;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return true;
  };
};
