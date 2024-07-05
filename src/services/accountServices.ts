import { dbPool } from "../db/db";

export async function incrementVerificationEmailCount(accountID: number, emailsSentCount: number): Promise<void> {
  if (emailsSentCount > 3) {
    return;
  };

  try {
    await dbPool.execute(
      `UPDATE Accounts
      SET verification_emails_sent = ?
      WHERE account_id = ?`,
      [++emailsSentCount, accountID]
    );

  } catch (err: any) {
    console.log(err);
  };
};