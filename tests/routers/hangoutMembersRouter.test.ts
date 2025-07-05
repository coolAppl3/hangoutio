import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { dayMilliseconds, HANGOUT_CONCLUSION_STAGE, hourMilliseconds, MAX_ONGOING_HANGOUTS_LIMIT } from '../../src/util/constants';
import { RowDataPacket } from 'mysql2';
import * as authSessionModule from '../../src/auth/authSessions';
import { generateAuthSessionId } from '../../src/util/tokenGenerator';
import * as cookeUtils from '../../src/util/cookieUtils';
import * as hangoutWebSocketServerModule from '../../src/webSockets/hangout/hangoutWebSocketServer';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';
import { encryptPassword } from '../../src/util/encryptionUtils';
import * as addHangoutEventModule from '../../src/util/addHangoutEvent';

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
const addHangoutEventSpy = jest.spyOn(addHangoutEventModule, 'addHangoutEvent');


describe('POST hangoutMembers/joinHangout/account', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/account')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/account')
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
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangoutMembers/joinHangout/account')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutPassword: null });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null, someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangoutMembers/joinHangout/account')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout ID.');
      expect(response.body.reason).toBe('invalidHangoutId');
    };

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutPassword: null });
    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013', hangoutPassword: null });
    await testHangoutId({ hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutPassword: null });
    await testHangoutId({ hangoutId: '1749132719013', hangoutPassword: null });
  });

  it('should reject requests with an invalid hangout password that is not null', async () => {
    async function testHangoutPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangoutMembers/joinHangout/account')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout password.');
      expect(response.body.reason).toBe('invalidHangoutPassword');
    };

    await testHangoutPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 23 });
    await testHangoutPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: '' });
    await testHangoutPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'white space' });
    await testHangoutPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'beyondFortyCharactersForSomeIncrediblyWeirdReason' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null });

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
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null });

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

  it(`should reject requests made by a guest user`, async () => {
    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)});`,
      [1, 'johnDoe', 'somePassword', 'John Doe', 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`Guest accounts can't join more than one hangout.`);
    expect(response.body.reason).toBe('guestAccount');
  });

  it(`should reject requests if the account is not found, removing the authSessionId cookie, and destroying the auth session`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 23, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null });

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

  it('should reject requests if the user has reached the limit of ongoing hangouts joined at the same time', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    let hangoutValuesString: string = '';
    let hangoutMemberValuesString: string = '';

    for (let i = 0; i < MAX_ONGOING_HANGOUTS_LIMIT; i++) {
      hangoutValuesString += `('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_${1749132719013 + i + 1}', 'someTitle', ${null}, ${10}, ${dayMilliseconds}, ${dayMilliseconds}, ${dayMilliseconds}, ${1}, ${Date.now()}, ${Date.now()}, ${false}),`;

      hangoutMemberValuesString += `(${i + 1}, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_${1749132719013 + i + 1}', 'johnDoe', 'account', ${1}, ${null}, 'John Doe', ${false}),`;
    };

    hangoutValuesString = hangoutValuesString.slice(0, -1);
    hangoutMemberValuesString = hangoutMemberValuesString.slice(0, -1);

    await dbPool.execute(`INSERT INTO hangouts VALUES ${hangoutValuesString};`);
    await dbPool.execute(`INSERT INTO hangout_members VALUES ${hangoutMemberValuesString};`);

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`You've reached the limit of ${MAX_ONGOING_HANGOUTS_LIMIT} ongoing hangouts.`);
    expect(response.body.reason).toBe('hangoutsLimitReached');
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
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it('should reject requests if the user is already a member of the hangout', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe("Already a member of this hangout.");
    expect(response.body.reason).toBe('alreadyJoined');
  });

  it('should reject requests if the hangout is password-protected, but the password is incorrect', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', encryptPassword('someHangoutPassword'), 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'incorrectPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe("Incorrect hangout password.");
    expect(response.body.reason).toBe('hangoutPassword');
  });

  it('should reject requests if the hangout is full', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0,
        2, 'example2@example.com', 'someHashedPassword', 'johnDoe2', 'John Doe', Date.now(), true, 0,
        3, 'exampl3e@example.com', 'someHashedPassword', 'johnDoe3', 'John Doe', Date.now(), true, 0
      ]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 2, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe2', 'account', 2, null, 'John Doe', true,
        3, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe3', 'account', 3, null, 'John Doe', true
      ]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'incorrectPassword' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe("Hangout full.");
    expect(response.body.reason).toBe('hangoutFull');
  });

  it('should accept the request, create a hangout_member row for the user, add a hangout event, and send a websocket message', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/account')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null });

    expect(response.status).toBe(200);
    expect(addHangoutEventSpy).toHaveBeenCalled();

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangout_members WHERe account_id = ? AND hangout_id = ?;`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(createdRows.length).toBe(1);
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('POST hangoutMembers/joinHangout/guest', () => {
  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/guest')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangoutMembers/joinHangout/guest')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutPassword: null, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null, password: 'somePassword', displayName: 'John Doe' });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null, username: 'johnDoe', displayName: 'John Doe' });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null, username: 'johnDoe', password: 'somePassword' });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe', someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangoutMembers/joinHangout/guest')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutPassword: null, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013', hangoutPassword: null, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutId({ hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutPassword: null, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutId({ hangoutId: '1749132719013', hangoutPassword: null, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });
  });

  it('should reject requests with an invalid hangout password that is not null', async () => {
    async function testHangoutPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangoutMembers/joinHangout/guest')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout password.');
      expect(response.body.reason).toBe('invalidHangoutPassword');
    };

    await testHangoutPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'white space', username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: '!nv@l!d', username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });
  });

  it('should reject requests with an invalid username', async () => {
    async function testUsername(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangoutMembers/joinHangout/guest')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid username.');
      expect(response.body.reason).toBe('invalidUsername');
    };

    await testUsername({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: null, password: 'somePassword', displayName: 'John Doe' });

    await testUsername({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'john', password: 'somePassword', displayName: 'John Doe' });

    await testUsername({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'beyondTwentyFiveCharacters', password: 'somePassword', displayName: 'John Doe' });

    await testUsername({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'white space', password: 'somePassword', displayName: 'John Doe' });

    await testUsername({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: '!nv@l!d', password: 'somePassword', displayName: 'John Doe' });
  });

  it('should reject requests with an invalid user password', async () => {
    async function testUserPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangoutMembers/joinHangout/guest')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid user password.');
      expect(response.body.reason).toBe('invalidUserPassword');
    };

    await testUserPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'johnDoe', password: 'short', displayName: 'John Doe' });

    await testUserPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'johnDoe', password: 'beyondFortyCharactersForSomeIncrediblyWeirdReason', displayName: 'John Doe' });

    await testUserPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'johnDoe', password: 'white space', displayName: 'John Doe' });

    await testUserPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'johnDoe', password: '!nv@l!d', displayName: 'John Doe' });
  });

  it('should reject requests if the username is identical to the user password', async () => {
    async function testUsernameAndPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangoutMembers/joinHangout/guest')
        .send(requestData);

      expect(response.status).toBe(409);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe(`Password can't be identical to username.`);
      expect(response.body.reason).toBe('passwordEqualsUsername');
    };

    await testUsernameAndPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'johnDoe23', password: 'johnDoe23', displayName: 'John Doe' });
    await testUsernameAndPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'someUsername', password: 'someUsername', displayName: 'John Doe' });
  });

  it('should reject requests with an invalid display name', async () => {
    async function testDisplayName(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangoutMembers/joinHangout/guest')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid display name.');
      expect(response.body.reason).toBe('invalidDisplayName');
    };

    await testDisplayName({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'johnDoe', password: 'somePassword', displayName: '' });

    await testDisplayName({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'johnDoe', password: 'somePassword', displayName: 'beyondTwentyFiveCharacters' });

    await testDisplayName({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'johnDoe', password: 'somePassword', displayName: 'double  white  space' });
  });

  it('should reject the request if the hangout is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/guest')
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'somePassword', username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it('should reject the request if the hangout is password-protected, but the hangout password is incorrect', async () => {
    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', encryptPassword('somePassword'), 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/guest')
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: 'incorrectPassword', username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Incorrect hangout password.');
    expect(response.body.reason).toBe('hangoutPassword');
  });

  it('should reject the request if the hangout is full', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        2, 'example2@example.com', 'someHashedPassword', 'johnDoe2', 'John Doe', Date.now(), true, 0,
        3, 'exampl3e@example.com', 'someHashedPassword', 'johnDoe3', 'John Doe', Date.now(), true, 0
      ]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 2, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe2', 'account', 2, null, 'John Doe', false,
        3, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe3', 'account', 3, null, 'John Doe', false
      ]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/guest')
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Hangout full.');
    expect(response.body.reason).toBe('hangoutFull');
  });

  it('should reject the request if the username is already taken by a registered user', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/guest')
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Username already taken.');
    expect(response.body.reason).toBe('usernameTaken');
  });

  it('should reject the request if the username is already taken by a guest user', async () => {
    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)});`,
      [1, 'johnDoe', 'somePassword', 'John Doe', 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/guest')
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Username already taken.');
    expect(response.body.reason).toBe('usernameTaken');
  });

  it('should accept the request, create a guest account, create a hangout member row, create an auth session, add a hangout event, send a websocket message, and return a boolean value on whether an auth session was successfully created', async () => {
    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    const setResponseCookieSpy = jest.spyOn(cookeUtils, 'setResponseCookie');

    const response: SuperTestResponse = await request(app)
      .post('/api/hangoutMembers/joinHangout/guest')
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutPassword: null, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty('authSessionCreated');
    expect(typeof response.body.authSessionCreated).toBe('boolean');

    const [createdGuestRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM guests WHERE username = ?;`,
      ['johnDoe']
    );

    const [createdHangoutMemberRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangout_members WHERe username = ? AND hangout_id = ?;`,
      ['johnDoe', 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(createdGuestRows.length).toBe(1);
    expect(createdHangoutMemberRows.length).toBe(1);

    expect(setResponseCookieSpy).toHaveBeenCalled();
    expect(addHangoutEventSpy).toHaveBeenCalled();
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('DELETE hangoutMembers/kick', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/kick')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/kick')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without a hangout ID, hangout member ID, and the ID of the member to kick in the URL query string', async () => {
    async function testQueryString(queryString: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/hangoutMembers/kick${queryString}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testQueryString('');
    await testQueryString('?');
    await testQueryString('?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1');
    await testQueryString('?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&memberToKickId=2');
    await testQueryString('?hangoutMemberId=1&memberToKickId=2');
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(hangoutId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/hangoutMembers/kick?hangoutId=${hangoutId}&hangoutMemberId=1&memberToKickId=2`)
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
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutMemberId(hangoutMemberId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/hangoutMembers/kick?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=${hangoutMemberId}&memberToKickId=2`)
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

  it('should reject requests with an invalid ID for the member to kick', async () => {
    async function testMemberToKickId(memberToKickId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/hangoutMembers/kick?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&memberToKickId=${memberToKickId}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid member to kick ID.');
    };

    await testMemberToKickId('23.5');
    await testMemberToKickId('white space');
    await testMemberToKickId('!nv@l!d');
  });

  it('should reject requests if the hangout member ID is identical to the member to kick ID', async () => {
    const response: SuperTestResponse = await request(app)
      .delete(`/api/hangoutMembers/kick?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&memberToKickId=1`)
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send();

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`You can't kick yourself.`);
    expect(response.body.reason).toBe('selfKick');
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/kick?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&memberToKickId=2')
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
      .delete('/api/hangoutMembers/kick?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&memberToKickId=2')
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
      .delete('/api/hangoutMembers/kick?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&memberToKickId=2')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it('should reject requests if the user is not a member of the hangout, removing the authSessionId cookie, and destroying the auth session', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)});`,
      [1, 'johnDoe2', 'somePassword', 'John Doe', 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe2', 'guest', null, 1, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/kick?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&memberToKickId=2')
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

    expect(deletedRows.length).toBe(0);
  });

  it('should reject requests if user is not the hangout leader', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', false]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/kick?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&memberToKickId=2')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Not hangout leader.');
    expect(response.body.reason).toBe('notHangoutLeader');
  });

  it('should accept the request if the member is not found without taking any further action', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/kick?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&memberToKickId=2')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);
  });

  it('should accept the request, delete the hangout member, delete any votes or suggestion likes made by them if the hangout is not concluded, delete their account if they are a guest user, add a hangout event, and send a websocket message', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)});`,
      [1, 'johnDoe2', 'somePassword', 'John Doe', 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe2', 'guest', null, 1, 'John Doe', true]
    );

    await dbPool.execute(
      `INSERT INTO suggestions VALUES (${generatePlaceHolders(8)});`,
      [1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false]
    );

    await dbPool.execute(
      `INSERT INTO suggestion_likes VALUES (${generatePlaceHolders(4)});`,
      [1, 1, 2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    await dbPool.execute(
      `INSERT INTO votes VALUES (${generatePlaceHolders(4)});`,
      [1, 1, 2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/kick?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&memberToKickId=2')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangout_events WHERE hangout_id = ?`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(createdRows.length).toBe(1);

    const [deletedGuestRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM guests WHERE guest_id = ?;`,
      [1]
    );

    const [deletedHangoutMemberRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangout_members WHERE hangout_member_id = ?;`,
      [2]
    );

    const [deletedSuggestionLikeRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM suggestion_likes WHERE hangout_member_id = ?;`,
      [2]
    );

    const [deletedVoteRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM votes WHERE hangout_member_id = ?;`,
      [2]
    );

    expect(deletedGuestRows.length).toBe(0);
    expect(deletedHangoutMemberRows.length).toBe(0);
    expect(deletedSuggestionLikeRows.length).toBe(0);
    expect(deletedVoteRows.length).toBe(0);

    expect(addHangoutEventSpy).toHaveBeenCalled();
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('DELETE hangoutMembers/leave', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/leave')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/leave')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without a hangout member ID and a hangout ID in the URL query string', async () => {
    async function testQueryString(queryString: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/hangoutMembers/leave${queryString}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testQueryString('');
    await testQueryString('?');
    await testQueryString('?hangoutMemberId=1');
    await testQueryString('?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013');
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutMemberId(hangoutMemberId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/hangoutMembers/leave?hangoutMemberId=${hangoutMemberId}&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013`)
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
        .delete(`/api/hangoutMembers/leave?hangoutMemberId=1&hangoutId=${hangoutId}`)
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
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/leave?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
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
      .delete('/api/hangoutMembers/leave?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
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

    expect(deletedRows.length).toBe(0);
  });

  it('should reject requests if the user hangout member row is not found', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/leave?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it('should reject requests if the user hangout member row is found, but refers to to a different hangout', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719023', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719023', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/leave?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
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
      ['dummyAuthSessionIdForTesting1234', 2, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true,
        2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'saraSmith', 'account', 2, null, 'Sara Smith', false
      ]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/leave?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
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

    expect(deletedRows.length).toBe(0);
  });

  it('should accept the request, delete the hangout member row, delete any associated suggestion likes and votes if the hangout is not yet concluded, delete the user account if they are a guest, add a hangout event, and send a websocket message', async () => {
    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)});`,
      [1, 'johnDoe', 'somePassword', 'John Doe', 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'guest', null, 1, 'John Doe', true]
    );

    await dbPool.execute(
      `INSERT INTO suggestions VALUES (${generatePlaceHolders(8)});`,
      [1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title', 'Some suggestion description', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false]
    );

    await dbPool.execute(
      `INSERT INTO suggestion_likes VALUES (${generatePlaceHolders(4)});`,
      [1, 1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    await dbPool.execute(
      `INSERT INTO votes VALUES (${generatePlaceHolders(4)});`,
      [1, 1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/hangoutMembers/leave?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    const [deletedGuestRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM guests WHERE guest_id = ?;`,
      [1]
    );

    const [deletedHangoutMemberRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangout_members WHERE hangout_member_id = ?;`,
      [1]
    );

    const [deletedSuggestionLikeRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM suggestion_likes WHERE hangout_member_id = ?;`,
      [1]
    );

    const [deletedVoteRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM votes WHERE hangout_member_id = ?;`,
      [1]
    );

    expect(deletedGuestRows.length).toBe(0);
    expect(deletedHangoutMemberRows.length).toBe(0);
    expect(deletedSuggestionLikeRows.length).toBe(0);
    expect(deletedVoteRows.length).toBe(0);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangout_events WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(createdRows.length).toBe(1);

    expect(addHangoutEventSpy).toHaveBeenCalled();
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('PATCH hangoutMembers/relinquishLeadership', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangoutMembers/relinquishLeadership')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangoutMembers/relinquishLeadership')
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
      .patch('/api/hangoutMembers/relinquishLeadership')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangoutMembers/relinquishLeadership')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutMemberId: 1 });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangoutMembers/relinquishLeadership')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1 });
    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013', hangoutMemberId: 1 });
    await testHangoutId({ hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1 });
    await testHangoutId({ hangoutId: '1749132719013', hangoutMemberId: 1 });
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangoutMembers/relinquishLeadership')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout member ID.');
    };

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: null });
    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 23.5 });
    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: '23.5' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangoutMembers/relinquishLeadership')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 23 });

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
      .patch('/api/hangoutMembers/relinquishLeadership')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

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
      .patch('/api/hangoutMembers/relinquishLeadership')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it('should reject requests if the user is not the hangout leader', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', false]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangoutMembers/relinquishLeadership')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe(`You're not the hangout leader.`);
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, HANGOUT_CONCLUSION_STAGE, Date.now(), Date.now(), true]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangoutMembers/relinquishLeadership')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout has already been concluded.');
  });

  it('should accept the request, unassign the leader role from the user, add a hangout event, and send a websocket message', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangoutMembers/relinquishLeadership')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

    expect(response.status).toBe(200);

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT is_leader FROM hangout_members WHERE hangout_member_id = ?;`,
      [1]
    );

    expect(updatedRows[0].is_leader).toBe(0);

    expect(addHangoutEventSpy).toHaveBeenCalled();
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});