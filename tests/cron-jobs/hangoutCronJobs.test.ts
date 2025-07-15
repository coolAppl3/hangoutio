import { dbPool } from '../../src/db/db';
import { RowDataPacket } from 'mysql2';
import { dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE, hourMilliseconds, minuteMilliseconds } from '../../src/util/constants';
import { progressHangouts, concludeNoSuggestionHangouts, concludeSingleSuggestionHangouts, deleteEmptyHangouts } from '../../src/cron-jobs/hangoutCronJobs';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';
import * as hangoutWebSocketServerModule from '../../src/webSockets/hangout/hangoutWebSocketServer';

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

afterAll(async () => {
  await dbPool.end();
});

interface HangoutDetails extends RowDataPacket {
  hangout_id: string,
  current_stage: number,
  is_concluded: boolean,
};

const sendHangoutWebSocketMessageSpy = jest.spyOn(hangoutWebSocketServerModule, 'sendHangoutWebSocketMessage');

describe('progressHangouts()', () => {
  it('should progress the stage of any hangouts that have not been concluded, where the difference between the stage control timestamp and the current timestamp is larger than the length of the current stage, sending a websocket message in the process, and adding a hangout event if the hangout is concluded', async () => {
    const nextStageTimestamp: number = Date.now() - dayMilliseconds - minuteMilliseconds;

    await dbPool.execute(
      `INSERT INTO
        hangouts
      VALUES (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)});`,
      [
        'hangout_id_1', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, nextStageTimestamp - minuteMilliseconds, Date.now(), false,

        'hangout_id_2', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_SUGGESTIONS_STAGE, nextStageTimestamp - minuteMilliseconds, Date.now(), false,

        'hangout_id_3', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, nextStageTimestamp - minuteMilliseconds, Date.now(), false,

        'hangout_id_4', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_CONCLUSION_STAGE, nextStageTimestamp - minuteMilliseconds, Date.now(), true
      ]
    );

    await progressHangouts();

    const [updatedRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangout_id,
        current_stage,
        is_concluded
      FROM
        hangouts;`
    );

    const firstHangout: HangoutDetails | undefined = updatedRows[0];
    const secondHangout: HangoutDetails | undefined = updatedRows[1];
    const thirdHangout: HangoutDetails | undefined = updatedRows[2];
    const fourthHangout: HangoutDetails | undefined = updatedRows[3];

    expect(firstHangout.hangout_id).toBe('hangout_id_1');
    expect(firstHangout.current_stage).toBe(HANGOUT_SUGGESTIONS_STAGE);
    expect(firstHangout.is_concluded).toBe(0);

    expect(secondHangout.hangout_id).toBe('hangout_id_2');
    expect(secondHangout.current_stage).toBe(HANGOUT_VOTING_STAGE);
    expect(secondHangout.is_concluded).toBe(0);

    expect(thirdHangout.hangout_id).toBe('hangout_id_3');
    expect(thirdHangout.current_stage).toBe(HANGOUT_CONCLUSION_STAGE);
    expect(thirdHangout.is_concluded).toBe(1);

    expect(fourthHangout.hangout_id).toBe('hangout_id_4');
    expect(fourthHangout.current_stage).toBe(HANGOUT_CONCLUSION_STAGE);
    expect(fourthHangout.is_concluded).toBe(1);

    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangout_events WHERE hangout_id = ?;`,
      ['hangout_id_3']
    );
    expect(createdRows).toHaveLength(1);
  });
});

describe('concludeSingleSuggestionHangouts()', () => {
  it('should conclude any hangout that has reached the voting stage with a single suggestion, adding a hangout event and sending a websocket message in the process', async () => {
    await dbPool.execute(
      `INSERT INTO
        hangouts
      VALUES (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)});`,
      [
        'hangout_id_1', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, Date.now(), Date.now(), false,

        'hangout_id_2', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, Date.now(), Date.now(), false,

        'hangout_id_3', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, Date.now(), Date.now(), false,

        'hangout_id_4', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, Date.now(), Date.now(), false
      ]
    );

    await dbPool.execute(
      `INSERT INTO
        accounts
      VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'example1@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0,
        2, 'example2@example.com', 'someHashedPassword', 'saraSmith', 'Sara Smith', Date.now(), true, 0,
        3, 'example3@example.com', 'someHashedPassword', 'janeDoe', 'Jane Doe', Date.now(), true, 0,
        4, 'example4@example.com', 'someHashedPassword', 'samSmith', 'Sam Smith', Date.now(), true, 0
      ]
    );

    await dbPool.execute(
      `INSERT INTO
        hangout_members
      VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'hangout_id_1', 'johnDoe', 'account', 1, null, 'John Doe', true,
        2, 'hangout_id_2', 'saraSmith', 'account', 1, null, 'John Doe', true,
        3, 'hangout_id_3', 'janeDoe', 'account', 1, null, 'John Doe', true,
        4, 'hangout_id_4', 'samSmith', 'account', 1, null, 'John Doe', true
      ]
    );

    const suggestionStartTimestamp: number = Date.now() + (dayMilliseconds * 4);
    const suggestionEndTimestamp: number = Date.now() + (dayMilliseconds * 4) + hourMilliseconds;

    await dbPool.execute(
      `INSERT INTO
        suggestions
      VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 1, 'hangout_id_1', 'Some Title', 'Suggestion description', suggestionStartTimestamp, suggestionEndTimestamp, false,
        2, 2, 'hangout_id_2', 'Some Title', 'Suggestion description', suggestionStartTimestamp, suggestionEndTimestamp, false,
        3, 3, 'hangout_id_3', 'Some Title', 'Suggestion description', suggestionStartTimestamp, suggestionEndTimestamp, false,
        4, 4, 'hangout_id_4', 'Some Title', 'Suggestion description', suggestionStartTimestamp, suggestionEndTimestamp, false
      ]
    );

    await concludeSingleSuggestionHangouts();

    const [updatedRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangout_id,
        current_stage,
        is_concluded
      FROM
        hangouts;`
    );

    const firstHangout: HangoutDetails | undefined = updatedRows[0];
    const secondHangout: HangoutDetails | undefined = updatedRows[1];
    const thirdHangout: HangoutDetails | undefined = updatedRows[2];
    const fourthHangout: HangoutDetails | undefined = updatedRows[3];

    expect(firstHangout.hangout_id).toBe('hangout_id_1');
    expect(firstHangout.current_stage).toBe(HANGOUT_CONCLUSION_STAGE);
    expect(firstHangout.is_concluded).toBe(1);

    expect(secondHangout.hangout_id).toBe('hangout_id_2');
    expect(secondHangout.current_stage).toBe(HANGOUT_CONCLUSION_STAGE);
    expect(secondHangout.is_concluded).toBe(1);

    expect(thirdHangout.hangout_id).toBe('hangout_id_3');
    expect(thirdHangout.current_stage).toBe(HANGOUT_CONCLUSION_STAGE);
    expect(thirdHangout.is_concluded).toBe(1);

    expect(fourthHangout.hangout_id).toBe('hangout_id_4');
    expect(fourthHangout.current_stage).toBe(HANGOUT_CONCLUSION_STAGE);
    expect(fourthHangout.is_concluded).toBe(1);

    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalledTimes(1);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT hangout_id) as created_rows_count FROM hangout_events;`
    );

    expect(createdRows[0].created_rows_count).toBe(4);
  });
});

describe('concludeNoSuggestionHangouts()', () => {
  it('should conclude any hangout that has reached the voting stage without a single suggestion, adding a hangout event and sending a websocket message in the process', async () => {
    await dbPool.execute(
      `INSERT INTO
        hangouts
      VALUES (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)});`,
      [
        'hangout_id_1', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, Date.now(), Date.now(), false,

        'hangout_id_2', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, Date.now(), Date.now(), false,

        'hangout_id_3', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, Date.now(), Date.now(), false,

        'hangout_id_4', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, Date.now(), Date.now(), false
      ]
    );

    await dbPool.execute(
      `INSERT INTO
        accounts
      VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'example1@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0,
        2, 'example2@example.com', 'someHashedPassword', 'saraSmith', 'Sara Smith', Date.now(), true, 0,
        3, 'example3@example.com', 'someHashedPassword', 'janeDoe', 'Jane Doe', Date.now(), true, 0,
        4, 'example4@example.com', 'someHashedPassword', 'samSmith', 'Sam Smith', Date.now(), true, 0
      ]
    );

    await dbPool.execute(
      `INSERT INTO
        hangout_members
      VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'hangout_id_1', 'johnDoe', 'account', 1, null, 'John Doe', true,
        2, 'hangout_id_2', 'saraSmith', 'account', 1, null, 'John Doe', true,
        3, 'hangout_id_3', 'janeDoe', 'account', 1, null, 'John Doe', true,
        4, 'hangout_id_4', 'samSmith', 'account', 1, null, 'John Doe', true
      ]
    );

    await concludeNoSuggestionHangouts();

    const [updatedRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangout_id,
        current_stage,
        is_concluded
      FROM
        hangouts;`
    );

    const firstHangout: HangoutDetails | undefined = updatedRows[0];
    const secondHangout: HangoutDetails | undefined = updatedRows[1];
    const thirdHangout: HangoutDetails | undefined = updatedRows[2];
    const fourthHangout: HangoutDetails | undefined = updatedRows[3];

    expect(firstHangout.hangout_id).toBe('hangout_id_1');
    expect(firstHangout.current_stage).toBe(HANGOUT_CONCLUSION_STAGE);
    expect(firstHangout.is_concluded).toBe(1);

    expect(secondHangout.hangout_id).toBe('hangout_id_2');
    expect(secondHangout.current_stage).toBe(HANGOUT_CONCLUSION_STAGE);
    expect(secondHangout.is_concluded).toBe(1);

    expect(thirdHangout.hangout_id).toBe('hangout_id_3');
    expect(thirdHangout.current_stage).toBe(HANGOUT_CONCLUSION_STAGE);
    expect(thirdHangout.is_concluded).toBe(1);

    expect(fourthHangout.hangout_id).toBe('hangout_id_4');
    expect(fourthHangout.current_stage).toBe(HANGOUT_CONCLUSION_STAGE);
    expect(fourthHangout.is_concluded).toBe(1);

    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalledTimes(1);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT hangout_id) as created_rows_count FROM hangout_events;`
    );

    expect(createdRows[0].created_rows_count).toBe(4);
  });
});

describe('concludeNoSuggestionHangouts()', () => {
  it('should delete any hangout without any hangout members in it', async () => {
    await dbPool.execute(
      `INSERT INTO
        hangouts
      VALUES (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)}), (${generatePlaceHolders(11)});`,
      [
        'hangout_id_1', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, Date.now(), Date.now(), false,

        'hangout_id_2', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_SUGGESTIONS_STAGE, Date.now(), Date.now(), false,

        'hangout_id_3', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, Date.now(), Date.now(), false,

        'hangout_id_4', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, Date.now(), Date.now(), true
      ]
    );

    await deleteEmptyHangouts();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM hangouts;`);
    expect(deletedRows).toHaveLength(0);
  });
});