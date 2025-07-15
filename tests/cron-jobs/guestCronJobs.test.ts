import { dbPool } from '../../src/db/db';
import { RowDataPacket } from 'mysql2';
import { dayMilliseconds } from '../../src/util/constants';
import { deleteStaleGuestUsers } from '../../src/cron-jobs/guestCronJobs';
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

describe('deleteStaleGuestUsers()', () => {
  it('should delete guest users related to hangouts that have been concluded for longer than 60 days', async () => {
    const createdOnTimestamp: number = Date.now() - (dayMilliseconds * 32 * 2);

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, createdOnTimestamp, createdOnTimestamp + (dayMilliseconds * 3), true]
    );

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)}), (${generatePlaceHolders(5)});`,
      [
        1, 'johnDoe1', 'somePassword', 'John Doe', 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013',
        2, 'johnDoe2', 'somePassword', 'John Doe', 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013',
      ]
    );

    await deleteStaleGuestUsers();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM guests;`);
    expect(deletedRows).toHaveLength(0);
  });
});