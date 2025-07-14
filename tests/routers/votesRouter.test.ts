import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE, hourMilliseconds } from '../../src/util/constants';
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

describe('POST votes', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/votes')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/votes')
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
      .post('/api/votes')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/votes')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutMemberId: 1, suggestionId: 1 });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', suggestionId: 1 });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1, someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/votes')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, suggestionId: 1 });
    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013', hangoutMemberId: 1, suggestionId: 1 });
    await testHangoutId({ hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, suggestionId: 1 });
    await testHangoutId({ hangoutId: '1749132719013', hangoutMemberId: 1, suggestionId: 1 });
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutMemberId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/votes')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout member ID.');
    };

    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: null, suggestionId: 1 });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: '', suggestionId: 1 });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 23.5, suggestionId: 1 });
  });

  it('should reject requests with an invalid suggestion ID', async () => {
    async function testHangoutMemberId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/votes')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid suggestion ID.');
    };

    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: null });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: '' });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 23.5 });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

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
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

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

    expect(deletedRows).toHaveLength(0);
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
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

    expect(response.status).toBe(404);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Hangout not found.');
    expect(response.body.reason).toBe('hangoutNotFound');
  });

  it(`should reject requests if the hangout member user ID doesn't match the requester's user ID, removing the authSessionId cookie, and destroying the auth session`, async () => {
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
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

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

    expect(deletedRows).toHaveLength(0);
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
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

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
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`Hangout isn't in the voting stage.`);
    expect(response.body.reason).toBe('inAvailabilityStage');
  });

  it('should reject requests if the hangout is in the suggestions stage', async () => {
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
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`Hangout isn't in the voting stage.`);
    expect(response.body.reason).toBe('inSuggestionsStage');
  });

  it('should reject requests if the suggestion is not found', async () => {
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
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

    expect(response.status).toBe(404);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Suggestion not found.');
    expect(response.body.reason).toBe('suggestionNotFound');
  });

  it('should accept the request if the suggestion is already liked without taking further action', async () => {
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

    await dbPool.execute(
      `INSERT INTO suggestions VALUES (${generatePlaceHolders(8)});`,
      [1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false]
    );

    await dbPool.execute(
      `INSERT INTO votes VALUES (${generatePlaceHolders(4)});`,
      [1, 1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

    expect(response.status).toBe(200);
  });

  it('should reject requests if the user has reached their vote limit', async () => {
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

    await dbPool.execute(
      `INSERT INTO suggestions VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title 1', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false,
        2, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title 2', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false,
        3, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title 3', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false,
        4, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title 4', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false
      ]
    );

    await dbPool.execute(
      `INSERT INTO votes VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [
        1, 2, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013',
        2, 3, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013',
        3, 4, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013'
      ]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Votes limit reached.');
    expect(response.body.reason).toBe('votesLimitReached');
  });

  it('should accept the request, add the vote, and send a websocket message', async () => {
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

    await dbPool.execute(
      `INSERT INTO suggestions VALUES (${generatePlaceHolders(8)});`,
      [1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/votes')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, suggestionId: 1 });

    expect(response.status).toBe(201);
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM votes WHERE hangout_member_id = ?;`,
      [1]
    );

    expect(createdRows).toHaveLength(1);
  });
});

describe('DELETE votes', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/votes')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/votes')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without a suggestion ID, hangout member ID, and hangout ID in the URL query string', async () => {
    async function testQueryString(queryString: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/votes${queryString}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testQueryString('');
    await testQueryString('?');
    await testQueryString('?suggestionId=1&hangoutMemberId=1');
    await testQueryString('?suggestionId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013');
    await testQueryString('?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013');
  });

  it('should reject requests with an invalid suggestion ID', async () => {
    async function testSuggestionId(suggestionId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/votes?suggestionId=${suggestionId}&hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid suggestion ID.');
    };

    await testSuggestionId('23.5');
    await testSuggestionId('white space');
    await testSuggestionId('!nv@l!d');
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutMemberId(hangoutMemberId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/votes?suggestionId=1&hangoutMemberId=${hangoutMemberId}&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout member ID.');
    };

    await testHangoutMemberId('23.5');
    await testHangoutMemberId('white space');
    await testHangoutMemberId('!nv@l!d');
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(hangoutId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/votes?suggestionId=1&hangoutMemberId=1&hangoutId=${hangoutId}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR');
    await testHangoutId('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013');
    await testHangoutId('1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR');
    await testHangoutId('1749132719013');
    await testHangoutId('white space');
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/votes?suggestionId=1&hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

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
      .delete('/api/votes?suggestionId=1&hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

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

    expect(deletedRows).toHaveLength(0);
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
      .delete('/api/votes?suggestionId=1&hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it(`should reject requests if the hangout member user ID doesn't match the requester's user ID, removing the authSessionId cookie, and destroying the auth session`, async () => {
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
      .delete('/api/votes?suggestionId=1&hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

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

    expect(deletedRows).toHaveLength(0);
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
      .delete('/api/votes?suggestionId=1&hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

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
      .delete('/api/votes?suggestionId=1&hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`Hangout isn't in the voting stage.`);
    expect(response.body.reason).toBe('inAvailabilityStage');
  });

  it('should reject requests if the hangout is in the suggestions stage', async () => {
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
      .delete('/api/votes?suggestionId=1&hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`Hangout isn't in the voting stage.`);
    expect(response.body.reason).toBe('inSuggestionsStage');
  });

  it('should accept the request if the vote is not found without taking any further action', async () => {
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

    await dbPool.execute(
      `INSERT INTO suggestions VALUES (${generatePlaceHolders(8)});`,
      [1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/votes?suggestionId=1&hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);
  });

  it('should accept the request, delete the vote, and send a websocket message', async () => {
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

    await dbPool.execute(
      `INSERT INTO suggestions VALUES (${generatePlaceHolders(8)});`,
      [1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false]
    );

    await dbPool.execute(
      `INSERT INTO votes VALUES (${generatePlaceHolders(4)});`,
      [1, 1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/votes?suggestionId=1&hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM votes WHERE vote_id = ?;`,
      [1]
    );

    expect(deletedRows).toHaveLength(0);
  });
});