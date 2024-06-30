import { dbPool } from "../db/db";
import { Response } from "express";

export async function checkVotesLimit(res: Response, hangoutMemberID: number): Promise<boolean> {
  try {
    const [rows]: any = await dbPool.execute(
      `SELECT vote_id FROM Votes
      WHERE hangout_member_id = ?`,
      [hangoutMemberID]
    );

    if (rows.length >= 3) {
      res.status(400).json({ success: false, message: 'Vote limit reached.' });
      return true;
    };

    return false;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return true;
  };
};

export async function checkForDuplicateVote(res: Response, hangoutMemberID: number, suggestionID: number): Promise<boolean> {
  try {
    const [rows]: any = await dbPool.execute(
      `SELECT vote_id FROM Votes
      WHERE hangout_member_id = ? AND suggestion_id = ?`,
      [hangoutMemberID, suggestionID]
    );

    if (rows.length !== 0) {
      res.status(400).json({ success: false, message: 'Duplicate vote.' });
      return true;
    };

    return false;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return true;
  };
};