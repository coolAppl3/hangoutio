import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { dayMilliseconds, HANGOUT_AVAILABILITY_SLOTS_LIMIT, HANGOUT_AVAILABILITY_STAGE, HANGOUT_SUGGESTIONS_LIMIT, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE, hourMilliseconds, minuteMilliseconds } from '../../src/util/constants';
import { RowDataPacket } from 'mysql2';
import * as authSessionModule from '../../src/auth/authSessions';
import { generateAuthSessionId } from '../../src/util/tokenGenerator';
import * as cookeUtils from '../../src/util/cookieUtils';
import * as hangoutWebSocketServerModule from '../../src/webSockets/hangout/hangoutWebSocketServer';
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

afterEach(() => {
  jest.clearAllMocks();
});

const removeRequestCookieSpy = jest.spyOn(cookeUtils, 'removeRequestCookie');
const destroyAuthSessionSpy = jest.spyOn(authSessionModule, 'destroyAuthSession');
const sendHangoutWebSocketMessageSpy = jest.spyOn(hangoutWebSocketServerModule, 'sendHangoutWebSocketMessage');

describe('POST suggestions', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=invalidId`)
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/suggestions')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now() });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds, someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/suggestions')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testHangoutId({ hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testHangoutId({ hangoutId: '1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutMemberId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/suggestions')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout member ID.');
    };

    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: null, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: NaN, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 23.5, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: '23.5', suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });
  });

  it('should reject requests with an invalid suggestion title', async () => {
    async function testSuggestionTitle(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/suggestions')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid suggestion title.');
      expect(response.body.reason).toBe('invalidTitle');
    };

    await testSuggestionTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: null, suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testSuggestionTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 23, suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testSuggestionTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: '', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testSuggestionTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Ab', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testSuggestionTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'aSuggestionTitleBeyondFortyCharactersLong', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    await testSuggestionTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'forbidden_$ymbols-', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });
  });

  it('should reject requests with an invalid suggestion description', async () => {
    async function testSuggestionDescription(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/suggestions')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid suggestion description.');
      expect(response.body.reason).toBe('invalidDescription');
    };

    await testSuggestionDescription({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: null, suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });
    await testSuggestionDescription({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 23, suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });
    await testSuggestionDescription({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: '', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });
    await testSuggestionDescription({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Too short', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    let extremelyLongDescription: string = '';

    for (let i = 0; i < 501; i++) {
      extremelyLongDescription += 'A';
    };

    await testSuggestionDescription({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: extremelyLongDescription, suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it(`should reject requests if the user's auth session is found but is invalid, removing the authSessionId cookie, and destroying the auth session`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now() - hourMilliseconds, Date.now()]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(destroyAuthSessionSpy).toHaveBeenCalled();
    expect(removeRequestCookieSpy).toHaveBeenCalled();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE session_id = ?;`,
      ['dummyAuthSessionIdForTesting1234']
    );

    expect(deletedRows.length).toBe(0);
  });

  it('should reject requests if the hangout is not found', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it(`should reject requests if the hangout member user id doesn't match the requester's user ID, removing the authSessionId cookie, and destroying the auth session`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [2, 'other@example.com', 'someHashedPassword', 'saraSmith', 'Sara Smith', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'saraSmith', 'account', 2, null, 'Sara Smith', false]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Invalid credentials. Request denied.');
    expect(response.body.reason).toBe('authSessionDestroyed');

    expect(destroyAuthSessionSpy).toHaveBeenCalled();
    expect(removeRequestCookieSpy).toHaveBeenCalled();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE session_id = ?;`,
      ['dummyAuthSessionIdForTesting1234']
    );

    expect(deletedRows.length).toBe(0);
  });

  it('should reject requests if the hangout is concluded', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), true]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Hangout has already been concluded.');
    expect(response.body.reason).toBe('hangoutConcluded');
  });

  it('should reject requests if the hangout is in the availability stage', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`Hangout isn't in the suggestions stage.`);
    expect(response.body.reason).toBe('inAvailabilityStage');
  });

  it('should reject requests if the hangout is in the voting stage', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_VOTING_STAGE, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`Hangout isn't in the suggestions stage.`);
    expect(response.body.reason).toBe('inVotingStage');
  });

  it('should reject requests with if the suggestion starts before the hangout conclusion timestamp', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_SUGGESTIONS_STAGE, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now(), suggestionEndTimestamp: Date.now() + hourMilliseconds });

    expect(response.status).toBe(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Invalid suggestion date and time.');
    expect(response.body.reason).toBe('invalidSlot');
  });

  it('should reject requests if the suggestion starts beyond 6 months after the hangout conclusion timestamp', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_SUGGESTIONS_STAGE, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const suggestionStartTimestamp: number = Date.now() + (dayMilliseconds * 31 * 7);
    const suggestionEndTimestamp: number = Date.now() + (dayMilliseconds * 31 * 7) + hourMilliseconds;

    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp, suggestionEndTimestamp });

    expect(response.status).toBe(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Invalid suggestion date and time.');
    expect(response.body.reason).toBe('invalidSlot');
  });

  it('should reject requests if the user has reached the suggestions limit', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_SUGGESTIONS_STAGE, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    await dbPool.execute(
      `INSERT INTO suggestions VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false,
        2, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false,
        3, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false,
      ]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now() + (dayMilliseconds * 4), suggestionEndTimestamp: Date.now() + (dayMilliseconds * 4) + hourMilliseconds });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`Suggestions limit of ${HANGOUT_SUGGESTIONS_LIMIT} reached.`);
    expect(response.body.reason).toBe('limitReached');
  });

  it('should accept the request, add the suggestion, return the suggestion ID, and send a websocket message', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_SUGGESTIONS_STAGE, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/suggestions')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionTitle: 'Some Title', suggestionDescription: 'Some suggestion description.', suggestionStartTimestamp: Date.now() + (dayMilliseconds * 4), suggestionEndTimestamp: Date.now() + (dayMilliseconds * 4) + hourMilliseconds });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('suggestionId');
    expect(Number.isInteger(response.body.suggestionId)).toBe(true);

    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();;
  });
});