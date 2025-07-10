import { dbPool } from '../../src/db/db';
import { RowDataPacket } from 'mysql2';
import { dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE, hourMilliseconds, minuteMilliseconds } from '../../src/util/constants';
import { replenishRateRequests, removeStaleRateTrackerRows, removeLightRateAbusers } from '../../src/cron-jobs/rateLimiterCronJobs';
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

describe('replenishRateRequests()', () => {
  it('should reduce the number of requests count by half the request allowance for any rate_tracker rows whose window_timestamp is 30 seconds old or older, or reset the count to 0 if half the allowance has not been used', async () => {
    const windowTimestamp: number = Date.now() - (1000 * 35);

    await dbPool.execute(
      `INSERT INTO
        rate_tracker
      VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [
        'dummy_id_1', 80, 120, windowTimestamp,
        'dummy_id_2', 60, 100, windowTimestamp,
        'dummy_id_3', 30, 50, windowTimestamp,
        'dummy_id_4', 15, 25, windowTimestamp
      ]
    );

    await replenishRateRequests();

    interface RateTrackerDetails extends RowDataPacket {
      rate_limit_id: number,
      general_requests_count: number,
      chat_requests_count: number,
    };

    const [updatedRows] = await dbPool.execute<RateTrackerDetails[]>(
      `SELECT
        rate_limit_id,
        general_requests_count,
        chat_requests_count
      FROM
        rate_tracker;`
    );

    const firstRateTracker: RateTrackerDetails = updatedRows[0];
    const secondRateTracker: RateTrackerDetails = updatedRows[1];
    const thirdRateTracker: RateTrackerDetails = updatedRows[2];
    const fourthRateTracker: RateTrackerDetails = updatedRows[3];

    expect(firstRateTracker.rate_limit_id).toBe('dummy_id_1');
    expect(firstRateTracker.general_requests_count).toBe(50);
    expect(firstRateTracker.chat_requests_count).toBe(70);

    expect(secondRateTracker.rate_limit_id).toBe('dummy_id_2');
    expect(secondRateTracker.general_requests_count).toBe(30);
    expect(secondRateTracker.chat_requests_count).toBe(50);

    expect(thirdRateTracker.rate_limit_id).toBe('dummy_id_3');
    expect(thirdRateTracker.general_requests_count).toBe(0);
    expect(thirdRateTracker.chat_requests_count).toBe(0);

    expect(fourthRateTracker.rate_limit_id).toBe('dummy_id_4');
    expect(fourthRateTracker.general_requests_count).toBe(0);
    expect(fourthRateTracker.chat_requests_count).toBe(0);
  });
});

describe('removeStaleRateTrackerRows()', () => {
  it('should delete any rate_tracker rows that are older than a minute, with both the general requests and chat requests counts being 0', async () => {
    const windowTimestamp: number = Date.now() - (minuteMilliseconds * 2);

    await dbPool.execute(
      `INSERT INTO
        rate_tracker
      VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [
        'dummy_id_1', 0, 0, windowTimestamp,
        'dummy_id_2', 0, 0, windowTimestamp
      ]
    );

    await removeStaleRateTrackerRows();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM rate_tracker;`);
    expect(deletedRows.length).toBe(0);
  });
});

describe('removeLightRateAbusers()', () => {
  it('should delete any abusive_users rows where the limit count is equal to or less than 10, and it has not been incremented for at last an hour', async () => {
    await dbPool.execute(
      `INSERT INTO
        abusive_users
      VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [
        '100.100.100.100', Date.now() - (hourMilliseconds * 10), Date.now() - hourMilliseconds, 10,
        '100.100.100.101', Date.now() - (hourMilliseconds * 10), Date.now() - hourMilliseconds, 5,
        '100.100.100.102', Date.now() - (hourMilliseconds * 10), Date.now() - hourMilliseconds, 20
      ]
    );

    await removeLightRateAbusers();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT ip_address FROM abusive_users;`);
    expect(deletedRows.length).toBe(1);

    expect(deletedRows[0].ip_address).toBe('100.100.100.102');
  });
});