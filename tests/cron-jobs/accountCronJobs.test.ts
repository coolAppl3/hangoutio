import { dbPool } from '../../src/db/db';
import { RowDataPacket } from 'mysql2';
import { hourMilliseconds, minuteMilliseconds } from '../../src/util/constants';
import { removeExpiredDeletionRequests, removeExpiredEmailUpdateRequests, removeExpiredRecoveryRequests, removeUnverifiedAccounts } from '../../src/cron-jobs/accountCronJobs';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';

beforeEach(async () => {
  interface TableNames extends RowDataPacket {
    table_name: string,
  };

  const [tableRows] = await dbPool.execute<TableNames[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = ?;`,
    [process.env.TEST_DATABASE_NAME]
  );

  let clearDatabaseStatement: string = '';

  for (const row of tableRows) {
    clearDatabaseStatement += `DELETE FROM ${row.table_name};`;
  };

  await dbPool.query(clearDatabaseStatement);
});

afterAll(async () => {
  await dbPool.end();
});

describe('removeUnverifiedAccounts()', () => {
  it('should delete any unverified accounts whose verification timestamp has passed', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), false, 0,
        2, 'other@example.com', 'someHashedPassword', 'saraSmith', 'Sara Smith', Date.now(), false, 0
      ]
    );

    await dbPool.execute(
      `INSERT INTO account_verification VALUES (${generatePlaceHolders(6)}), (${generatePlaceHolders(6)});`,
      [
        1, 1, 'AAAAAA', 1, 0, Date.now() - hourMilliseconds,
        2, 2, 'AAAAAA', 1, 0, Date.now() - minuteMilliseconds
      ]
    );

    await removeUnverifiedAccounts();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM accounts;`);
    expect(deletedRows).toHaveLength(0);
  });
});

describe('removeExpiredRecoveryRequests()', () => {
  it('should delete any expired recovery requests', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), false, 0,
        2, 'other@example.com', 'someHashedPassword', 'saraSmith', 'Sara Smith', Date.now(), false, 0
      ]
    );

    await dbPool.execute(
      `INSERT INTO account_recovery VALUES (${generatePlaceHolders(6)}), (${generatePlaceHolders(6)});`,
      [
        1, 1, 'AAAAAA', Date.now() - hourMilliseconds, 1, 0,
        2, 2, 'AAAAAA', Date.now() - minuteMilliseconds, 1, 0,
      ]
    );

    await removeExpiredRecoveryRequests();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM account_recovery;`);
    expect(deletedRows).toHaveLength(0);
  });
});

describe('removeExpiredEmailUpdateRequests()', () => {
  it('should delete any expired email update requests', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), false, 0,
        2, 'other@example.com', 'someHashedPassword', 'saraSmith', 'Sara Smith', Date.now(), false, 0
      ]
    );

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)}), (${generatePlaceHolders(7)});`,
      [
        1, 1, 'new1@example.com', 'AAAAAA', Date.now() - hourMilliseconds, 1, 0,
        2, 2, 'new2@example.com', 'AAAAAA', Date.now() - minuteMilliseconds, 1, 0
      ]
    );

    await removeExpiredEmailUpdateRequests();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM email_update;`);
    expect(deletedRows).toHaveLength(0);
  });
});

describe('removeExpiredDeletionRequests()', () => {
  it('should delete any expired account deletion requests', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), false, 0,
        2, 'other@example.com', 'someHashedPassword', 'saraSmith', 'Sara Smith', Date.now(), false, 0
      ]
    );

    await dbPool.execute(
      `INSERT INTO account_deletion VALUES (${generatePlaceHolders(6)}), (${generatePlaceHolders(6)});`,
      [
        1, 1, 'AAAAAA', Date.now() - hourMilliseconds, 1, 0,
        2, 2, 'AAAAAA', Date.now() - minuteMilliseconds, 1, 0
      ]
    );

    await removeExpiredDeletionRequests();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM account_deletion;`);
    expect(deletedRows).toHaveLength(0);
  });
});