import { dbPool } from '../../src/db/db';
import { RowDataPacket } from 'mysql2';
import { hourMilliseconds, minuteMilliseconds } from '../../src/util/constants';
import { clearExpiredAuthSessions } from '../../src/cron-jobs/authCronJobs';
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

describe('clearExpiredAuthSessions()', () => {
  it('should delete any expired auth sessions', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), false, 0,
        2, 'other@example.com', 'someHashedPassword', 'saraSmith', 'Sara Smith', Date.now(), false, 0
      ]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)}), (${generatePlaceHolders(5)});`,
      [
        1, 1, 'account', Date.now() - hourMilliseconds * 7, Date.now() - hourMilliseconds,
        2, 2, 'account', Date.now() - (hourMilliseconds * 6.5), Date.now() - (hourMilliseconds / 2)
      ]
    );

    await clearExpiredAuthSessions();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM auth_sessions;`);
    expect(deletedRows).toHaveLength(0);
  });
});