import { dbPool } from '../../src/db/db';
import { RowDataPacket } from 'mysql2';
import { dayMilliseconds } from '../../src/util/constants';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';
import { clearErrorLogs } from '../../src/logs/loggerCronJobs';

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

afterEach(() => {
  jest.clearAllMocks();
});

describe('clearErrorLogs()', () => {
  it('should delete any rows in the unexpected_errors table with a timestamp two days old or older', async () => {
    await dbPool.execute<RowDataPacket[]>(
      `INSERT INTO
        unexpected_errors
      VALUES (${generatePlaceHolders(6)}), (${generatePlaceHolders(6)}), (${generatePlaceHolders(6)});`,
      [
        1, 'POST', '/api/someEndpoint', Date.now(), 'Some error message.', 'Some stack trace.',
        2, 'PATCH', '/api/someEndpoint', Date.now() - (2 * dayMilliseconds), 'Some error message.', 'Some stack trace.',
        3, 'GET', '/api/someEndpoint', Date.now() - (3 * dayMilliseconds), 'Some error message.', 'Some stack trace.',
      ]
    );

    await clearErrorLogs();

    const [remainingRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM unexpected_errors;`);
    expect(remainingRows.length).toBe(1);
  });
});