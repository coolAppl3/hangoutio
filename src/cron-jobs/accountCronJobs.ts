import { dbPool } from "../db/db";

export async function removeUnverifiedAccounts(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    await dbPool.execute(
      `DELETE
        accounts
      FROM
        accounts
      INNER JOIN
        account_verification ON accounts.account_id = account_verification.account_id
      WHERE
        account_verification.expiry_timestamp <= ?;`,
      [currentTimestamp]
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${removeUnverifiedAccounts.name}`)
    console.log(err);
  };
};

export async function removeExpiredRecoveryRequests(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    await dbPool.execute(
      `DELETE FROM
        account_recovery
      WHERE
        expiry_timestamp <= ?;`,
      [currentTimestamp]
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${removeExpiredRecoveryRequests.name}`)
    console.log(err);
  };
};

export async function removeExpiredEmailUpdateRequests(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    await dbPool.execute(
      `DELETE FROM
        email_update
      WHERE
        expiry_timestamp <= ?;`,
      [currentTimestamp]
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