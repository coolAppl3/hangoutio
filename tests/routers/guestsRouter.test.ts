import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { dayMilliseconds } from '../../src/util/constants';
import { RowDataPacket } from 'mysql2';
import * as authSessionModule from '../../src/auth/authSessions';
import * as cookeUtils from '../../src/util/cookieUtils';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';
import bcrypt from 'bcrypt';

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

describe('POST guests/signIn', () => {
  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/guests/signIn')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ password: 'somePassword' });
    await testKeys({ username: 'johnDoe' });
    await testKeys({ username: 'johnDoe', password: 'somePassword', someRandomValue: 23 });
  });

  it('should reject requests with an invalid username', async () => {
    async function testUsername(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/guests/signIn')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid username.');
    };

    await testUsername({ username: 'john', password: 'somePassword' });
    await testUsername({ username: 'beyondTwentyFiveCharacters', password: 'somePassword' });
    await testUsername({ username: '!nval!dU$sern@me', password: 'somePassword' });
  });

  it('should reject requests with an invalid password', async () => {
    async function testPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/guests/signIn')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid password.');
    };

    await testPassword({ username: 'johnDoe', password: '' });
    await testPassword({ username: 'johnDoe', password: 'white space' });
    await testPassword({ username: 'johnDoe', password: 'beyondFortyCharactersForSomeIncrediblyWeirdReason' });
  });

  it('should reject requests if the guest account is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/guests/signIn')
      .send({ username: 'johnDoe', password: 'somePassword' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Guest account not found.');
  });

  it('should reject requests if the password is incorrect', async () => {
    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)});`,
      [1, 'johnDoe', hashedPassword, 'John Doe', 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/guests/signIn')
      .send({ username: 'johnDoe', password: 'incorrectPassword' });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Incorrect password.');
  });

  it('should accept the request, create an auth session and add the authSessionId cookie to the response', async () => {
    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)});`,
      [1, 'johnDoe', hashedPassword, 'John Doe', 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    const createAuthSessionSpy = jest.spyOn(authSessionModule, 'createAuthSession');
    const setResponseCookieSpy = jest.spyOn(cookeUtils, 'setResponseCookie');

    const response: SuperTestResponse = await request(app)
      .post('/api/guests/signIn')
      .send({ username: 'johnDoe', password: 'somePassword' });

    expect(response.status).toBe(200);

    expect(createAuthSessionSpy).toHaveBeenCalled();
    expect(setResponseCookieSpy).toHaveBeenCalled();
  });
});