import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { dayMilliseconds, hourMilliseconds } from '../../src/util/constants';
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

describe('POST chat', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/chat')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/chat')
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
      .post('/api/chat')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/chat')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: 'Some message.' });
    await testKeys({ hangoutMemberId: 1, messageContent: 'Some message.' });
    await testKeys({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', });
    await testKeys({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: 'Some message.', someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutMemberId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/chat')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout member ID.');
    };

    await testHangoutMemberId({ hangoutMemberId: null, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: 'Some message.' });

    await testHangoutMemberId({ hangoutMemberId: 23.5, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: 'Some message.' });

    await testHangoutMemberId({ hangoutMemberId: '23.5', hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: 'Some message.' });

  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/chat')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', messageContent: 'Some message.' });

    await testHangoutId({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013', messageContent: 'Some message.' });

    await testHangoutId({ hangoutMemberId: 1, hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', messageContent: 'Some message.' });

    await testHangoutId({ hangoutMemberId: 1, hangoutId: '1749132719013', messageContent: 'Some message.' });
  });

  it('should reject requests with invalid message content', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/chat')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid message content.');
    };

    let extremelyLongMessageContent: string = '';

    for (let i = 0; i < 2001; i++) {
      extremelyLongMessageContent += 'A';
    };

    await testHangoutId({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: '' });
    await testHangoutId({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: extremelyLongMessageContent });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/chat')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: 'Some message.' });

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
      .post('/api/chat')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: 'Some message.' });

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
      .post('/api/chat')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: 'Some message.' });

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
      .post('/api/chat')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: 'Some message.' });

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

  it('should accept the request, add a message row, return the message details, and send a websocket message', async () => {
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
      .post('/api/chat')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', messageContent: 'Some message.' });

    expect(response.status).toBe(201);

    expect(response.body).toHaveProperty('message_id');
    expect(Number.isInteger(response.body.message_id)).toBe(true);

    expect(response.body).toHaveProperty('hangout_member_id');
    expect(Number.isInteger(response.body.hangout_member_id)).toBe(true);

    expect(response.body).toHaveProperty('message_content');
    expect(typeof response.body.message_content).toBe('string');

    expect(response.body).toHaveProperty('message_timestamp');
    expect(Number.isInteger(response.body.message_timestamp)).toBe(true);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM chat WHERE hangout_member_id = ?;`,
      [1]
    );

    expect(createdRows).toHaveLength(1);
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('GET chat', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/chat')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/chat')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without a hangout ID, hangout member ID, and messageOffset in the URL query string', async () => {
    async function testQueryString(queryString: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .get(`/api/chat${queryString}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testQueryString('');
    await testQueryString('?');
    await testQueryString('?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1');
    await testQueryString('?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&messageOffset=0');
    await testQueryString('?hangoutMemberId=1&messageOffset=0');
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(hangoutId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .get(`/api/chat?hangoutId=${hangoutId}&hangoutMemberId=1&messageOffset=0`)
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
        .get(`/api/chat?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=${hangoutMemberId}&messageOffset=0`)
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

  it('should reject requests with an invalid message offset', async () => {
    async function testMessageOffset(messageOffset: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .get(`/api/chat?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&messageOffset=${messageOffset}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid message offset.');
    };

    await testMessageOffset('23.5');
    await testMessageOffset('white space');
    await testMessageOffset('!nv@l!d');
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/chat?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&messageOffset=0')
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
      .get('/api/chat?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&messageOffset=0')
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
      .get('/api/chat?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&messageOffset=0')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it('should accept the request, fetch any available messages with a limit of the HANGOUT_CHAT_FETCH_BATCH_SIZE constant, and return the array of messages reversed', async () => {
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

    await dbPool.execute(
      `INSERT INTO chat VALUES (${generatePlaceHolders(5)}), (${generatePlaceHolders(5)});`,
      [
        1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'First message', Date.now(),
        2, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Second message', Date.now()
      ]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/chat?hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013&hangoutMemberId=1&messageOffset=0')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    expect(Array.isArray(response.body));
    expect(response.body).toHaveLength(2);

    const newestMessage = response.body[0];

    expect(newestMessage).toHaveProperty('message_id');
    expect(Number.isInteger(newestMessage.message_id));

    expect(newestMessage).toHaveProperty('hangout_member_id');
    expect(Number.isInteger(newestMessage.hangout_member_id));

    expect(newestMessage).toHaveProperty('message_content');
    expect(typeof newestMessage.message_content).toBe('string');

    expect(newestMessage).toHaveProperty('message_timestamp');
    expect(Number.isInteger(newestMessage.message_timestamp));

    expect(newestMessage.message_content).toBe('Second message'); // ensuring the array is reversed before being sent back
  });
});