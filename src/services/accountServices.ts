import { Response } from "express";
import { dbPool } from "../db/db";

export async function incrementVerificationEmailCount(accountID: number): Promise<void> {
  try {
    await dbPool.execute(
      `UPDATE Accounts
      SET verification_emails_sent = verification_emails_sent + 1
      WHERE account_id = ?;`,
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
      SET failed_sign_in_attempts = failed_sign_in_attempts + 1
      WHERE account_id = ?;`,
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
      WHERE account_id = ?;`,
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
      WHERE account_id = ?;`,
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
      WHERE account_id = ?;`,
      [accountID]
    );

    return true;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return false;
  };
};

export async function resetFailedSignInAttempts(accountID: number): Promise<void> {
  try {
    await dbPool.execute(
      `UPDATE Accounts
      SET failed_sign_in_attempts = 0
      WHERE account_id = ?;`,
      [accountID]
    );

  } catch (err: any) {
    console.log(err);
  };
};

export async function findAccountIdByEmail(res: Response, email: string): Promise<number> {
  try {
    const [rows]: any = await dbPool.execute(
      `SELECT account_id FROM Accounts
      WHERE email = ?
      LIMIT 1;`,
      [email]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return 0;
    };

    const accountID: number = rows[0].account_id;
    return accountID;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return 0;
  };
};

export async function checkForOngoingRecovery(res: Response, accountID: number): Promise<boolean> {
  try {
    const [rows]: any = await dbPool.execute(
      `SELECT account_id FROM AccountRecovery
      WHERE account_id = ?
      LIMIT 1;`,
      [accountID]
    );

    if (rows.length === 0) {
      return false;
    };

    return true;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return false;
  };
};

export async function removeAccountRecoveryRow(recoveryToken: string): Promise<void> {
  try {
    await dbPool.execute(
      `DELETE FROM AccountRecovery
      WHERE recovery_token = ?`,
      [recoveryToken]
    );

  } catch (err: any) {
    console.log(err);
  };
};