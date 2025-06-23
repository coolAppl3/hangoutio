import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { dayMilliseconds, hourMilliseconds, MAX_HANGOUT_MEMBERS_LIMIT, MAX_ONGOING_HANGOUTS_LIMIT, MIN_HANGOUT_MEMBERS_LIMIT } from '../../src/util/constants';
import { RowDataPacket } from 'mysql2';
import * as authSessionModule from '../../src/auth/authSessions';
import { generateAuthSessionId, generateHangoutId } from '../../src/util/tokenGenerator';
import * as cookeUtils from '../../src/util/cookieUtils';
import * as hangoutWebSocketServerModule from '../../src/webSockets/hangout/hangoutWebSocketServer';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';
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

describe('POST hangouts/create/accountLeader', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/accountLeader')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/accountLeader')
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
      .post('/api/hangouts/create/accountLeader')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/accountLeader')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testKeys({ hangoutTitle: 'Some Title', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout title', async () => {
    async function testHangoutTitle(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/accountLeader')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout title.');
      expect(response.body.reason).toBe('invalidHangoutTitle');
    };

    await testHangoutTitle({ hangoutTitle: null, hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testHangoutTitle({ hangoutTitle: NaN, hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testHangoutTitle({ hangoutTitle: 23, hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testHangoutTitle({ hangoutTitle: '', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testHangoutTitle({ hangoutTitle: 'ab', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testHangoutTitle({ hangoutTitle: 'beyondTwentyFiveCharacters', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testHangoutTitle({ hangoutTitle: 'forbidden-!$%', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });
  });

  it(`should reject requests with a truthy password that's invalid`, async () => {
    async function testHangoutPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/accountLeader')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout password.');
      expect(response.body.reason).toBe('invalidHangoutPassword');
    };

    await testHangoutPassword({ hangoutTitle: 'Some Title', hangoutPassword: 23, membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testHangoutPassword({ hangoutTitle: 'Some Title', hangoutPassword: 'short', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testHangoutPassword({ hangoutTitle: 'Some Title', hangoutPassword: 'beyondFortyCharactersForSomeIncrediblyWeirdReason', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testHangoutPassword({ hangoutTitle: 'Some Title', hangoutPassword: 'forbiddenSymbols#$%^&', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });
  });

  it('should reject requests with an invalid members limit', async () => {
    async function testMemberLimit(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/accountLeader')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout members limit.');
      expect(response.body.reason).toBe('invalidMembersLimit');
    };

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: null, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 23.5, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: '20', availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 'someSTring', availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: MIN_HANGOUT_MEMBERS_LIMIT - 1, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: MAX_HANGOUT_MEMBERS_LIMIT + 1, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });
  });

  it('should reject requests with one or more invalid hangout period', async () => {
    async function testHangoutPeriods(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/accountLeader')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout stages configuration.');
      expect(response.body.reason).toBe('invalidHangoutPeriods');
    };

    await testHangoutPeriods({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: null, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    await testHangoutPeriods({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: dayMilliseconds / 3, suggestionsPeriod: dayMilliseconds * 2.5, votingPeriod: dayMilliseconds - 45000 });

    await testHangoutPeriods({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: null, suggestionsPeriod: NaN, votingPeriod: dayMilliseconds + 0.5 });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/accountLeader')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/accountLeader')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

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
      .post('/api/hangouts/create/accountLeader')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

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

  it(`should reject requests if the user is in too many ongoing hangouts`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO
        hangouts
      VALUES
        ('hangoutId1', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId2', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId3', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId4', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId5', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId6', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId7', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId8', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId9', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId10', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId11', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0),
        ('hangoutId12', 'someTitle', null, 10, 86400000, 86400000, 86400000, 1, 1750519146096, 1750519146096, 0);`
    );

    await dbPool.execute(
      `INSERT INTO
        hangout_members
      VALUES
        (1, 'hangoutId1', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (2, 'hangoutId2', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (3, 'hangoutId3', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (4, 'hangoutId4', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (5, 'hangoutId5', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (6, 'hangoutId6', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (7, 'hangoutId7', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (8, 'hangoutId8', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (9, 'hangoutId9', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (10, 'hangoutId10', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (11, 'hangoutId11', 'johnDoe', 'account', 1, null, 'JohnDoe', 0),
        (12, 'hangoutId12', 'johnDoe', 'account', 1, null, 'JohnDoe', 0);`
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/accountLeader')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`You've reached the limit of ${MAX_ONGOING_HANGOUTS_LIMIT} ongoing hangouts.`);
    expect(response.body.reason).toBe('hangoutsLimitReached');
  });

  it(`should should accept the request and create both a hangout and a hangout member row for the user, returning the new hangout ID, and inserting a hangout event`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/accountLeader')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds });

    expect(response.status).toBe(201);
    expect(addHangoutEventSpy).toHaveBeenCalled();

    expect(response.body).toHaveProperty('hangoutId');
    expect(typeof response.body.hangoutId).toBe('string');

    const [hangoutRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM hangouts WHERE hangout_title = ?;`, ['Some Title']);
    const [hangoutMemberRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM hangout_members WHERE account_id = ?;`, [1]);

    expect(hangoutRows.length).toBe(1);
    expect(hangoutMemberRows.length).toBe(1);

    const [eventRows] = await dbPool.execute<RowDataPacket[]>(`SELECT event_description FROM hangout_events WHERE hangout_id = ?`, [response.body.hangoutId]);

    expect(eventRows.length).toBe(1);
    expect(eventRows[0].event_description).toBe('John Doe created the hangout.');
  });
});

describe('POST hangouts/create/guestLeader', () => {
  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/guestLeader')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/guestLeader')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testKeys({ hangoutTitle: 'Some Title', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, password: 'somePassword', displayName: 'John Doe' });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', displayName: 'John Doe' });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword' });

    await testKeys({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe', someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout title', async () => {
    async function testHangoutTitle(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/guestLeader')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout title.');
      expect(response.body.reason).toBe('invalidHangoutTitle');
    };

    await testHangoutTitle({ hangoutTitle: null, hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutTitle({ hangoutTitle: NaN, hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutTitle({ hangoutTitle: 23, hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutTitle({ hangoutTitle: '', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutTitle({ hangoutTitle: 'ab', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutTitle({ hangoutTitle: 'beyondTwentyFiveCharacters', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutTitle({ hangoutTitle: 'forbidden-!$%', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });
  });

  it(`should reject requests with a truthy password that's invalid`, async () => {
    async function testHangoutPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/guestLeader')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout password.');
      expect(response.body.reason).toBe('invalidHangoutPassword');
    };

    await testHangoutPassword({ hangoutTitle: 'Some Title', hangoutPassword: 23, membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutPassword({ hangoutTitle: 'Some Title', hangoutPassword: 'short', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutPassword({ hangoutTitle: 'Some Title', hangoutPassword: 'beyondFortyCharactersForSomeIncrediblyWeirdReason', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutPassword({ hangoutTitle: 'Some Title', hangoutPassword: 'forbiddenSymbols#$%^&', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });
  });

  it('should reject requests with an invalid members limit', async () => {
    async function testMemberLimit(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/guestLeader')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout members limit.');
      expect(response.body.reason).toBe('invalidMembersLimit');
    };

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: null, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 23.5, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: '20', availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 'someSTring', availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: MIN_HANGOUT_MEMBERS_LIMIT - 1, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testMemberLimit({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: MAX_HANGOUT_MEMBERS_LIMIT + 1, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });
  });

  it('should reject requests with one or more invalid hangout period', async () => {
    async function testHangoutPeriods(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/guestLeader')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid hangout stages configuration.');
      expect(response.body.reason).toBe('invalidHangoutPeriods');
    };

    await testHangoutPeriods({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: null, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutPeriods({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: dayMilliseconds / 3, suggestionsPeriod: dayMilliseconds * 2.5, votingPeriod: dayMilliseconds - 45000, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    await testHangoutPeriods({ hangoutTitle: 'Some Title', hangoutPassword: 'someHangoutPassword', membersLimit: 10, availabilityPeriod: null, suggestionsPeriod: NaN, votingPeriod: dayMilliseconds + 0.5, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });
  });

  it('should reject requests with an invalid username', async () => {
    async function testUsername(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/guestLeader')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid guest username.');
      expect(response.body.reason).toBe('invalidUsername');
    };

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: null, password: 'somePassword', displayName: 'John Doe' });

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: NaN, password: 'somePassword', displayName: 'John Doe' });

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 23, password: 'somePassword', displayName: 'John Doe' });

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: '', password: 'somePassword', displayName: 'John Doe' });

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'beyondTwentyFiveCharacters', password: 'somePassword', displayName: 'John Doe' });

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'ab', password: 'somePassword', displayName: 'John Doe' });

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'white space', password: 'somePassword', displayName: 'John Doe' });
  });

  it('should reject requests with an invalid password', async () => {
    async function testUsername(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/guestLeader')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid guest password.');
      expect(response.body.reason).toBe('invalidGuestPassword');
    };

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: null, displayName: 'John Doe' });

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: NaN, displayName: 'John Doe' });

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 23, displayName: 'John Doe' });

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'short', displayName: 'John Doe' });

    await testUsername({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'beyondFortyCharactersForSomeIncrediblyWeirdReason', displayName: 'John Doe' });
  });

  it('should reject requests where the guest username and password are identical', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/guestLeader')
      .send({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe23', password: 'johnDoe23', displayName: 'John Doe' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`Password can't be identical to username.`);
    expect(response.body.reason).toBe('passwordEqualsUsername');
  });

  it('should reject requests with an invalid display name', async () => {
    async function testDisplayName(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/hangouts/create/guestLeader')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid guest display name.');
      expect(response.body.reason).toBe('invalidDisplayName');
    };

    await testDisplayName({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 23 });

    await testDisplayName({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: NaN });

    await testDisplayName({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: null });

    await testDisplayName({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'beyondTwentyFiveCharacters' });
  });

  it('should reject requests if the username is taken by a registered user', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example1@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/guestLeader')
      .send({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Username is already taken.');
    expect(response.body.reason).toBe('guestUsernameTaken');
  });

  it('should reject requests if the username is taken by another guest user', async () => {
    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['someId', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)});`,
      [1, 'johnDoe', 'somePassword', 'John Doe', 'someId']
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/guestLeader')
      .send({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Username is already taken.');
    expect(response.body.reason).toBe('guestUsernameTaken');
  });

  it('should accept the request and insert a row in the hangouts, guests, and hangout_members tables, create an auth session for the user, add the authSessionId to the response cookie, return the hangout ID, and add a hangout event', async () => {
    const createAuthSessionSpy = jest.spyOn(authSessionModule, 'createAuthSession');
    const setResponseCookieSpy = jest.spyOn(cookeUtils, 'setResponseCookie');

    const response: SuperTestResponse = await request(app)
      .post('/api/hangouts/create/guestLeader')
      .send({ hangoutTitle: 'Some Title', hangoutPassword: 'somePassword', membersLimit: 10, availabilityPeriod: dayMilliseconds, suggestionsPeriod: dayMilliseconds, votingPeriod: dayMilliseconds, username: 'johnDoe', password: 'somePassword', displayName: 'John Doe' });

    expect(response.status).toBe(201);

    expect(response.body).toHaveProperty('hangoutId');
    expect(response.body).toHaveProperty('authSessionCreated');

    expect(typeof response.body.hangoutId).toBe('string');
    expect(typeof response.body.authSessionCreated).toBe('boolean');

    expect(createAuthSessionSpy).toHaveBeenCalled();
    expect(setResponseCookieSpy).toHaveBeenCalled();
    expect(addHangoutEventSpy).toHaveBeenCalled();

    const [hangoutRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM hangouts WHERE hangout_title = ?`, ['Some Title']);
    const [guestRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM guests WHERE username = ?;`, ['johnDoe']);
    const [hangoutMemberRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM hangout_members WHERE username = ?;`, ['johnDoe']);

    expect(hangoutRows.length).toBe(1);
    expect(guestRows.length).toBe(1);
    expect(hangoutMemberRows.length).toBe(1);

    const [eventRows] = await dbPool.execute<RowDataPacket[]>(`SELECT event_description FROM hangout_events WHERE hangout_id = ?`, [response.body.hangoutId]);

    expect(eventRows.length).toBe(1);
    expect(eventRows[0].event_description).toBe('John Doe created the hangout.');
  });
});

describe('PATCH hangouts/details/updatePassword', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updatePassword')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updatePassword')
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
      .patch('/api/hangouts/details/updatePassword')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updatePassword')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutMemberId: 1, newPassword: 'someNewPassword' });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', newPassword: 'someNewPassword' });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword', someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updatePassword')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, newPassword: 'someNewPassword' });
    await testHangoutId({ hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, newPassword: 'someNewPassword' });
    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword' });
    await testHangoutId({ hangoutId: '1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword' });
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutMemberId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updatePassword')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout member ID.');
    };

    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: null, newPassword: 'someNewPassword' });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: NaN, newPassword: 'someNewPassword' });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 23.5, newPassword: 'someNewPassword' });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: '23', newPassword: 'someNewPassword' });
  });

  it('should reject requests with a truthy password that is invalid', async () => {
    async function testNewPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updatePassword')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid new hangout password.');
    };

    await testNewPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: '23.5' });
    await testNewPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'white space' });
    await testNewPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'beyondFortyCharactersForSomeIncrediblyWeirdReason' });
    await testNewPassword({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: '!nv@l!d' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword' });

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
      .patch('/api/hangouts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword' });

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

  it(`should reject requests if the hangout member details are not found, removing the authSessionId cookie, and destroying the auth session`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword' });

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
      .patch('/api/hangouts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword' });

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

  it(`should reject requests if the hangout member's hangout ID doesn't match the provided hangout ID`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const tempHangoutId: string = generateHangoutId(Date.now());

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      [tempHangoutId, 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, tempHangoutId, 'johnDoe', 'account', 1, null, 'John Doe', false]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it('should reject requests if the requester is not the hangout leader', async () => {
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
      .patch('/api/hangouts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`You're not the hangout leader.`);
    expect(response.body.reason).toBe('notHangoutLeader');
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
      .patch('/api/hangouts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword' });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout has already been concluded.');
  });

  it('should accept the request if the user provides a falsy value for the new password, aiming to remove it, but the hangout already does not have a password, taking no further action', async () => {
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
      .patch('/api/hangouts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: null });

    expect(response.status).toBe(200);
  });

  it('should accept the request, update the password, and if the hangout is now password protected, add a hangout event and send a websocket message', async () => {
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
      .patch('/api/hangouts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newPassword: 'someNewPassword' });

    expect(response.status).toBe(200);
    expect(addHangoutEventSpy).toHaveBeenCalled();

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT event_description FROM hangout_events WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(createdRows[0].event_description).toBe('Hangout password updated.');
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('PATCH hangouts/details/updateTitle', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updateTitle')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updateTitle')
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
      .patch('/api/hangouts/details/updateTitle')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updateTitle')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutMemberId: 1, newTitle: 'New Title' });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', newTitle: 'New Title' });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 'New Title', someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updateTitle')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, newTitle: 'New Title' });
    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013', hangoutMemberId: 1, newTitle: 'New Title' });
    await testHangoutId({ hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, newTitle: 'New Title' });
    await testHangoutId({ hangoutId: '1749132719013', hangoutMemberId: 1, newTitle: 'New Title' });
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutMemberId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updateTitle')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout member ID.');
    };

    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: null, newTitle: 'New Title' });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: NaN, newTitle: 'New Title' });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 23.5, newTitle: 'New Title' });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: '23', newTitle: 'New Title' });
  });

  it('should reject requests with an invalid new hangout title', async () => {
    async function testNewTitle(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updateTitle')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid new hangout title.');
      expect(response.body.reason).toBe('invalidNewTitle');
    };

    await testNewTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: null });
    await testNewTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: NaN });
    await testNewTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 23 });
    await testNewTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 'ab' });
    await testNewTitle({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 'forbidden-!$%' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updateTitle')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 'New Title' });

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
      .patch('/api/hangouts/details/updateTitle')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 'New Title' });

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

  it(`should reject requests if the hangout is not found`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updateTitle')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 'New Title' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it(`should reject requests if requester's user ID doesn't match the hangout member's user ID, removing the authSessionId cookie, and destroying the auth session`, async () => {
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
      [2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'saraSmith', 'account', 2, null, 'Sara Smith', false]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updateTitle')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 2, newTitle: 'New Title' });

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
      .patch('/api/hangouts/details/updateTitle')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 'New Title' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`You're not the hangout leader.`);
    expect(response.body.reason).toBe('notHangoutLeader');
  });

  it('should reject requests if the hangout has already been concluded', async () => {
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
      .patch('/api/hangouts/details/updateTitle')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 'New Title' });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout has already been concluded.');
  });

  it('should reject requests if the new hangout title matches the existing hangout title', async () => {
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
      .patch('/api/hangouts/details/updateTitle')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 'someTitle' });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout already has this title.');
  });

  it('should accept the request, update the hangout title, add a hangout event, and send a websocket message', async () => {
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
      .patch('/api/hangouts/details/updateTitle')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newTitle: 'New Title' });

    expect(response.status).toBe(200);
    expect(addHangoutEventSpy).toHaveBeenCalled();

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT hangout_title FROM hangouts WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(updatedRows[0].hangout_title).toBe('New Title');

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT event_description FROM hangout_events WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(createdRows[0].event_description).toBe('Hangout title was updated to: New Title.');

    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('PATCH hangouts/details/updateMembersLimit', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updateMembersLimit')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updateMembersLimit')
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
      .patch('/api/hangouts/details/updateMembersLimit')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updateMembersLimit')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutMemberId: 1, newMembersLimit: 10 });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', newMembersLimit: 10 });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });
    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: 10, someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updateMembersLimit')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, newMembersLimit: 10 });
    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013', hangoutMemberId: 1, newMembersLimit: 10 });
    await testHangoutId({ hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, newMembersLimit: 10 });
    await testHangoutId({ hangoutId: '1749132719013', hangoutMemberId: 1, newMembersLimit: 10 });
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutMemberId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updateMembersLimit')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout member ID.');
    };

    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: null, newMembersLimit: 10 });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: NaN, newMembersLimit: 10 });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 23.5, newMembersLimit: 10 });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: '23', newMembersLimit: 10 });
  });

  it('should reject requests with an invalid new members limit', async () => {
    async function testNewMembersLimit(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/updateMembersLimit')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid new members limit.');
    };

    await testNewMembersLimit({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: null });
    await testNewMembersLimit({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: NaN });
    await testNewMembersLimit({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: 23.5 });
    await testNewMembersLimit({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: '23.5' });
    await testNewMembersLimit({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: MIN_HANGOUT_MEMBERS_LIMIT - 1 });
    await testNewMembersLimit({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: MAX_HANGOUT_MEMBERS_LIMIT + 1 });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updateMembersLimit')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: 12 });

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
      .patch('/api/hangouts/details/updateMembersLimit')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: 12 });

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
      .patch('/api/hangouts/details/updateMembersLimit')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: 12 });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it(`should reject requests if requester's user ID doesn't match the hangout member's user ID, removing the authSessionId cookie, and destroying the auth session`, async () => {
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
      [2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'saraSmith', 'account', 2, null, 'Sara Smith', false]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updateMembersLimit')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 2, newMembersLimit: 12 });

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
      .patch('/api/hangouts/details/updateMembersLimit')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: 12 });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`You're not the hangout leader.`);
    expect(response.body.reason).toBe('notHangoutLeader');
  });

  it('should reject requests if the hangout has already been concluded', async () => {
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
      .patch('/api/hangouts/details/updateMembersLimit')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: 12 });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout has already been concluded.');
  });

  it('should accept the request if the new members limit is identical to the existing limit, without taking any further action', async () => {
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
      .patch('/api/hangouts/details/updateMembersLimit')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: 10 });

    expect(response.status).toBe(200);
  });

  it('should reject requests if the new members limit is below the count of existing hangout members', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [2, 'other1@example.com', 'someHashedPassword', 'saraSmith1', 'Sara Smith', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [3, 'other2@example.com', 'someHashedPassword', 'saraSmith2', 'Sara Smith', Date.now(), true, 0]
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
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [
        1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true,
        2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'saraSmith1', 'account', 2, null, 'Sara Smith', false,
        3, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'saraSmith2', 'account', 3, null, 'Sara Smith', false,
      ]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/updateMembersLimit')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: 2 });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe(`New members limit can't be lower than the number of existing members.`);
  });

  it('should accept the request, update the hangout members limit, add a hangout event, and send a websocket message', async () => {
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
      .patch('/api/hangouts/details/updateMembersLimit')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newMembersLimit: 12 });

    expect(response.status).toBe(200);

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT members_limit FROM hangouts WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(updatedRows[0].members_limit).toBe(12);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT event_description FROM hangout_events WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(createdRows[0].event_description).toBe('Hangout members limit was updated to 12.');

    expect(addHangoutEventSpy).toHaveBeenCalled();
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('PATCH hangouts/details/stages/update', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/update')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/update')
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
      .patch('/api/hangouts/details/stages/update')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/stages/update')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds });

    await testKeys({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds, someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/stages/update')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    await testHangoutId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    await testHangoutId({ hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    await testHangoutId({ hangoutId: '1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });
  });

  it('should reject requests with an invalid hangout member ID', async () => {
    async function testHangoutMemberID(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/stages/update')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout member ID.');
    };

    await testHangoutMemberID({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: null, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });
    await testHangoutMemberID({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: NaN, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });
    await testHangoutMemberID({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 23.5, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });
    await testHangoutMemberID({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: '23.5', newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/update')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

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
      .patch('/api/hangouts/details/stages/update')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

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
      .patch('/api/hangouts/details/stages/update')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    expect(response.status).toBe(404);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it(`should reject requests if requester's user ID doesn't match the hangout member's user ID, removing the authSessionId cookie, and destroying the auth session`, async () => {
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
      [2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'saraSmith', 'account', 2, null, 'Sara Smith', false]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/update')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 2, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

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
      .patch('/api/hangouts/details/stages/update')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`You're not the hangout leader.`);
    expect(response.body.reason).toBe('notHangoutLeader');
  });

  it('should reject requests if the hangout has already been concluded', async () => {
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
      .patch('/api/hangouts/details/stages/update')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout has already been concluded.');
  });

  it('should reject requests if one or more of the new hangout periods is invalid', async () => {
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

    async function testHangoutPeriods(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/stages/update')
        .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
        .send(requestData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid new hangout stages configuration.');
    };

    await testHangoutPeriods({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds / 3, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    await testHangoutPeriods({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds + 2.5, newVotingPeriod: dayMilliseconds * 20 });

    await testHangoutPeriods({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds * 20 });
  });

  it('should reject requests if the user attempts to update a period that has been concluded', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 2, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/update')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds * 2, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid new hangout stages configuration.');
  });

  it('should reject requests if the user attempts to update the current period to be shorter than how long it has lasted', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds * 3, dayMilliseconds, dayMilliseconds, 1, Date.now() - (dayMilliseconds * 1.5), Date.now() - (dayMilliseconds * 1), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/update')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds, newSuggestionsPeriod: dayMilliseconds, newVotingPeriod: dayMilliseconds });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid new hangout stages configuration.');
  });

  it('should accept the request, update the hangout periods, return the new hangout conclusion timestamp, delete any availability slots or suggestions that conflict with the new conclusion timestamp, add a hangout event, and send a websocket message', async () => {
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

    await dbPool.execute(
      `INSERT INTO availability_slots VALUES (${generatePlaceHolders(5)});`,
      [1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds]
    );

    await dbPool.execute(
      `INSERT INTO suggestions VALUES (${generatePlaceHolders(8)});`,
      [1, 1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'Some Title', 'Some suggestion description.', Date.now() + (dayMilliseconds * 4), Date.now() + (dayMilliseconds * 4) + hourMilliseconds, false]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/update')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1, newAvailabilityPeriod: dayMilliseconds * 3, newSuggestionsPeriod: dayMilliseconds * 3, newVotingPeriod: dayMilliseconds * 3 });

    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty('newConclusionTimestamp');
    expect(Number.isInteger(response.body.newConclusionTimestamp)).toBe(true);

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT availability_period, suggestions_period, voting_period FROM hangouts WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(updatedRows[0].availability_period).toBe(dayMilliseconds * 3);
    expect(updatedRows[0].suggestions_period).toBe(dayMilliseconds * 3);
    expect(updatedRows[0].voting_period).toBe(dayMilliseconds * 3);

    const [deletedAvailabilitySlotRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM availability_slots WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    const [deletedSuggestionRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM suggestions WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(deletedAvailabilitySlotRows.length).toBe(0);
    expect(deletedSuggestionRows.length).toBe(0);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT event_description FROM hangout_events WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(createdRows[0].event_description.includes('Hangout stages have been updated. The hangout will now be concluded on')).toBe(true);

    expect(addHangoutEventSpy).toHaveBeenCalled();
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('PATCH hangouts/details/stages/progress', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/progress')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/progress')
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
      .patch('/api/hangouts/details/stages/progress')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/stages/progress')
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
        .patch('/api/hangouts/details/stages/progress')
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
    async function testHangoutMemberId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/hangouts/details/stages/progress')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout member ID.');
    };

    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: null });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: NaN });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 23.5 });
    await testHangoutMemberId({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: '23.5' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/progress')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

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
      .patch('/api/hangouts/details/stages/progress')
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

  it(`should reject requests if the hangout is not found`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/progress')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it(`should reject requests if requester's user ID doesn't match the hangout member's user ID, removing the authSessionId cookie, and destroying the auth session`, async () => {
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
      [2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'saraSmith', 'account', 2, null, 'Sara Smith', false]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/progress')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 2 });

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
      .patch('/api/hangouts/details/stages/progress')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`You're not the hangout leader.`);
    expect(response.body.reason).toBe('notHangoutLeader');
  });

  it('should reject requests if the hangout has already been concluded', async () => {
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
      .patch('/api/hangouts/details/stages/progress')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout has already been concluded.');
  });

  it('should reject requests if the hangout is in the suggestions stage, but not suggestions have been made', async () => {
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
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 2, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'johnDoe', 'account', 1, null, 'John Doe', true]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/hangouts/details/stages/progress')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe(`Can't progress the hangout without any suggestions.`);
  });

  it('should accept the request, progress the hangout, return the updated hangout details, add a hangout event, and send a websocket message', async () => {
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
      .patch('/api/hangouts/details/stages/progress')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', hangoutMemberId: 1 });

    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty('availability_period');
    expect(Number.isInteger(response.body.availability_period)).toBe(true);

    expect(response.body).toHaveProperty('suggestions_period');
    expect(Number.isInteger(response.body.suggestions_period)).toBe(true);

    expect(response.body).toHaveProperty('voting_period');
    expect(Number.isInteger(response.body.voting_period)).toBe(true);

    expect(response.body).toHaveProperty('conclusion_timestamp');
    expect(Number.isInteger(response.body.conclusion_timestamp)).toBe(true);

    expect(response.body).toHaveProperty('stage_control_timestamp');
    expect(Number.isInteger(response.body.stage_control_timestamp)).toBe(true);

    expect(response.body).toHaveProperty('current_stage');
    expect(Number.isInteger(response.body.current_stage)).toBe(true);

    expect(response.body).toHaveProperty('is_concluded');
    expect([0, 1]).toContain(response.body.is_concluded);

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT current_stage FROM hangouts WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(updatedRows[0].current_stage).toBe(2);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT event_description FROM hangout_events WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(createdRows[0].event_description.includes('Hangout has been manually')).toBe(true);

    expect(addHangoutEventSpy).toHaveBeenCalled();
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('DELETE hangouts/', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/hangouts')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/hangouts')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without both a hangout member ID and hangout ID in the URL query string', async () => {
    async function testQueryString(queryString: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/hangouts?${queryString}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testQueryString('?');
    await testQueryString('?hangoutId');
    await testQueryString('?hangoutId=someId');
    await testQueryString('?hangoutId=someId');
    await testQueryString('?hangoutMemberId=someId');
  });

  it('should reject requests without an invalid hangout member ID', async () => {
    async function testHangoutMemberId(hangoutMemberId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/hangouts?hangoutMemberId=${hangoutMemberId}&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013`)
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

  it('should reject requests without an invalid hangout ID', async () => {
    async function testHangoutId(hangoutId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/hangouts?hangoutMemberId=1&hangoutId=${hangoutId}`)
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
      .delete('/api/hangouts?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
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
      .delete('/api/hangouts?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
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

  // ------------------------------

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
      .delete('/api/hangouts?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Hangout not found.');
  });

  it(`should reject requests if requester's user ID doesn't match the hangout member's user ID, removing the authSessionId cookie, and destroying the auth session`, async () => {
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
      [2, 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013', 'saraSmith', 'account', 2, null, 'Sara Smith', false]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/hangouts?hangoutMemberId=2&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
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
      .delete('/api/hangouts?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`You're not the hangout leader.`);
    expect(response.body.reason).toBe('notHangoutLeader');
  });

  it('should accept the request and delete the hangout, which associated hangout member rows', async () => {
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
      .delete('/api/hangouts?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    const [deletedHangoutRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangouts WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    const [deletedHangoutMemberRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangout_members WHERE hangout_id = ?;`,
      ['htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013']
    );

    expect(deletedHangoutRows.length).toBe(0);
    expect(deletedHangoutMemberRows.length).toBe(0);
  });
});