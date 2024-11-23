import { dbPool } from "../db/db";
import { RowDataPacket } from "mysql2";

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

export async function deleteMarkedAccounts(): Promise<void> {
  const cancellationWindow: number = 1000 * 60 * 60 * 24 * 2;
  const minimumAllowedTimestamp: number = Date.now() - cancellationWindow;

  interface AccountDetails extends RowDataPacket {
    account_id: number,
  };

  let connection;

  try {
    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    const [accountRows] = await connection.execute<AccountDetails[]>(
      `SELECT
        account_id
      FROM
        account_deletion
      WHERE
        request_timestamp < ?;`,
      [minimumAllowedTimestamp]
    );

    if (accountRows.length === 0) {
      await connection.commit();
      return;
    };

    const accountsToDelete: number[] = accountRows.map((account: AccountDetails) => account.account_id);
    await connection.execute(
      `DELETE FROM
        accounts
      WHERE
        account_id IN (?);`,
      [accountsToDelete.join(', ')]
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${deleteMarkedAccounts.name}`)
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

  } finally {
    if (connection) {
      connection.release();
    };
  };
};