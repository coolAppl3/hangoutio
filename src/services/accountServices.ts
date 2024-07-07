import { Response } from "express";
import { dbPool } from "../db/db";

export async function incrementVerificationEmailCount(accountID: number): Promise<void> {
  try {
    await dbPool.execute(
      `UPDATE Accounts
      SET verification_emails_sent = verification_emails_sent + 1
      WHERE account_id = ?`,
      [accountID]
    );

  } catch (err: any) {
    console.log(err);
  };
};

export async function incrementFailedSignInAttempts(accountID: number): Promise<void> {
  try {
    await dbPool.execute(
      `UPDATE Accounts
      SET failed_signin_attempts = failed_signin_attempts + 1
      WHERE account_id = ?`,
      [accountID]
    );

  } catch (err: any) {
    console.log(err);
  };
};

export async function incrementFailedVerificationAttempts(accountID: number): Promise<void> {
  try {
    await dbPool.execute(
      `UPDATE Accounts
      SET failed_verification_attempts = failed_verification_attempts + 1
      WHERE account_id = ?`,
      [accountID]
    );

  } catch (err: any) {
    console.log(err);
  };
};

export async function deleteAccount(accountID: number): Promise<void> {
  try {
    await dbPool.execute(
      `DELETE FROM Accounts
      WHERE account_id = ?`,
      [accountID]
    );

  } catch (err: any) {
    console.log(err);
  };
};

export async function verifyAccount(res: Response, accountID: number): Promise<boolean> {
  try {
    await dbPool.execute(
      `UPDATE Accounts
      SET is_verified = 1
      WHERE account_id = ?`,
      [accountID]
    );

    return true;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return false;
  };
};