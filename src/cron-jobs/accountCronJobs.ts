import { dbPool } from "../db/db";

export async function removeUnverifiedAccounts(): Promise<void> {
  const verificationWindow: number = 1000 * 60 * 20;
  const minimumAllowedTimestamp: number = Date.now() - verificationWindow;

  try {
    await dbPool.execute(
      `DELETE FROM
        accounts
      WHERE
        is_verified = ? AND
        created_on_timestamp < ?;`,
      [false, minimumAllowedTimestamp]
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${removeUnverifiedAccounts.name}`)
    console.log(err);
  };
};

export async function removeExpiredRecoveryRequests(): Promise<void> {
  const recoveryWindow: number = 1000 * 60 * 60;
  const minimumAllowedTimestamp: number = Date.now() - recoveryWindow;

  try {
    await dbPool.execute(
      `DELETE FROM
        account_recovery
      WHERE
        request_timestamp < ?;`,
      [minimumAllowedTimestamp]
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${removeExpiredRecoveryRequests.name}`)
    console.log(err);
  };
};

export async function removeExpiredEmailUpdateRequests(): Promise<void> {
  const updateWindow: number = 1000 * 60 * 60 * 24;
  const minimumAllowedTimestamp: number = Date.now() - updateWindow;

  try {
    await dbPool.execute(
      `DELETE FROM
        email_update
      WHERE
        request_timestamp < ?;`,
      [minimumAllowedTimestamp]
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${removeExpiredEmailUpdateRequests.name}`)
    console.log(err);
  };
};

export async function removeExpiredDeletionRequests(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    await dbPool.execute(
      `DELETE FROM
        account_deletion
      WHERE
        expiry_timestamp <= ?;`,
      [currentTimestamp]
    );

  } catch (err: unknown) {
    console.log(`CRON JOB ERROR: ${removeExpiredDeletionRequests.name}`)
    console.log(err);
  };
};