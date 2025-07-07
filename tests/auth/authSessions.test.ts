import { createAuthSession, destroyAuthSession, purgeAuthSessions } from '../../src/auth/authSessions';
import { Response } from 'express';
import * as cookieUtils from '../../src/util/cookieUtils';
import { dbPool } from '../../src/db/db';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';
import { RowDataPacket } from 'mysql2';
import { dayMilliseconds, hourMilliseconds } from '../../src/util/constants';

jest.mock('../../src/util/cookieUtils', () => ({
  setResponseCookie: jest.fn(),
}));

jest.mock('../../src/util/tokenGenerator', () => ({
  generateAuthSessionId: jest.fn(() => 'dummyAuthSessionIdForTesting1234'),
}));

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

const mockResponse = {
  cookie: jest.fn(),
} as unknown as Response;

interface CreateAuthSessionConfig {
  user_id: number,
  user_type: 'account' | 'guest',
  keepSignedIn: boolean,
};

const setResponseCookieSpy = jest.spyOn(cookieUtils, 'setResponseCookie');

describe('createAuthSession()', () => {
  it('should return false if the attempt count is greater than 3', async () => {
    const sessionConfig: CreateAuthSessionConfig = {
      user_id: 1,
      user_type: 'account',
      keepSignedIn: false,
    };

    const returnedValue: boolean = await createAuthSession(mockResponse, sessionConfig, 4);
    expect(returnedValue).toBe(false);
  });

  it('should, if the user has less than 3 auth sessions, create a new one, set an HTTP only authSessionId cookie, a signedInAs cookie conveying the user type, and have both their age be 6 hours if keepSignedIn is false', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const sessionConfig: CreateAuthSessionConfig = {
      user_id: 1,
      user_type: 'account',
      keepSignedIn: false,
    };

    const maxAge: number = sessionConfig.keepSignedIn ? hourMilliseconds * 24 * 7 : hourMilliseconds * 6;

    const returnedValue: boolean = await createAuthSession(mockResponse, sessionConfig);
    expect(returnedValue).toBe(true);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE user_id = ?;`,
      [1]
    );

    expect(createdRows.length).toBe(1);

    expect(setResponseCookieSpy).toHaveBeenCalledTimes(2);
    expect(setResponseCookieSpy).toHaveBeenCalledWith(mockResponse, 'authSessionId', 'dummyAuthSessionIdForTesting1234', maxAge, true);
    expect(setResponseCookieSpy).toHaveBeenCalledWith(mockResponse, 'signedInAs', sessionConfig.user_type, maxAge, false);
  });

  it('should, if the user has less than 3 auth sessions, create a new one, set an HTTP only authSessionId cookie, a signedInAs cookie conveying the user type, and have both their age be 7 days if keepSignedIn is true', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const sessionConfig: CreateAuthSessionConfig = {
      user_id: 1,
      user_type: 'account',
      keepSignedIn: true,
    };

    const maxAge: number = sessionConfig.keepSignedIn ? hourMilliseconds * 24 * 7 : hourMilliseconds * 6;

    const returnedValue: boolean = await createAuthSession(mockResponse, sessionConfig);
    expect(returnedValue).toBe(true);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE user_id = ?;`,
      [1]
    );

    expect(createdRows.length).toBe(1);

    expect(setResponseCookieSpy).toHaveBeenCalledTimes(2);
    expect(setResponseCookieSpy).toHaveBeenCalledWith(mockResponse, 'authSessionId', 'dummyAuthSessionIdForTesting1234', maxAge, true);
    expect(setResponseCookieSpy).toHaveBeenCalledWith(mockResponse, 'signedInAs', sessionConfig.user_type, maxAge, false);
  });

  it('should, if the user has 3 or more auth sessions, update the oldest one with a new ID, set an HTTP only authSessionId cookie, a signedInAs cookie conveying the user type, and have both their age be 6 hours if keepSignedIn is false', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)}), (${generatePlaceHolders(5)}), (${generatePlaceHolders(5)});`,
      [
        'dummyAuthSessionIdForTesting1231', 1, 'account', Date.now() - hourMilliseconds, Date.now() - dayMilliseconds,
        'dummyAuthSessionIdForTesting1232', 1, 'account', Date.now() - hourMilliseconds, Date.now() - hourMilliseconds,
        'dummyAuthSessionIdForTesting1233', 1, 'account', Date.now() - hourMilliseconds, Date.now(),
      ]
    );

    const sessionConfig: CreateAuthSessionConfig = {
      user_id: 1,
      user_type: 'account',
      keepSignedIn: false,
    };

    const maxAge: number = sessionConfig.keepSignedIn ? hourMilliseconds * 24 * 7 : hourMilliseconds * 6;

    const returnedValue: boolean = await createAuthSession(mockResponse, sessionConfig);
    expect(returnedValue).toBe(true);

    const [newAuthSession] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE session_id= ?;`,
      ['dummyAuthSessionIdForTesting1234']
    );

    const [oldAuthSession] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE session_id = ?;`,
      ['dummyAuthSessionIdForTesting1231']
    );

    expect(newAuthSession.length).toBe(1);
    expect(oldAuthSession.length).toBe(0);

    expect(setResponseCookieSpy).toHaveBeenCalledTimes(2);
    expect(setResponseCookieSpy).toHaveBeenCalledWith(mockResponse, 'authSessionId', 'dummyAuthSessionIdForTesting1234', maxAge, true);
    expect(setResponseCookieSpy).toHaveBeenCalledWith(mockResponse, 'signedInAs', sessionConfig.user_type, maxAge, false);
  });

  it('should, if the user has 3 or more auth sessions, update the oldest one with a new ID, set an HTTP only authSessionId cookie, a signedInAs cookie conveying the user type, and have both their age be 7 days if keepSignedIn is true', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)}), (${generatePlaceHolders(5)}), (${generatePlaceHolders(5)});`,
      [
        'dummyAuthSessionIdForTesting1231', 1, 'account', Date.now() - hourMilliseconds, Date.now() - dayMilliseconds,
        'dummyAuthSessionIdForTesting1232', 1, 'account', Date.now() - hourMilliseconds, Date.now() - hourMilliseconds,
        'dummyAuthSessionIdForTesting1233', 1, 'account', Date.now() - hourMilliseconds, Date.now(),
      ]
    );

    const sessionConfig: CreateAuthSessionConfig = {
      user_id: 1,
      user_type: 'account',
      keepSignedIn: true,
    };

    const maxAge: number = sessionConfig.keepSignedIn ? hourMilliseconds * 24 * 7 : hourMilliseconds * 6;

    const returnedValue: boolean = await createAuthSession(mockResponse, sessionConfig);
    expect(returnedValue).toBe(true);

    const [newAuthSession] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE session_id= ?;`,
      ['dummyAuthSessionIdForTesting1234']
    );

    const [oldAuthSession] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE session_id = ?;`,
      ['dummyAuthSessionIdForTesting1231']
    );

    expect(newAuthSession.length).toBe(1);
    expect(oldAuthSession.length).toBe(0);

    expect(setResponseCookieSpy).toHaveBeenCalledTimes(2);
    expect(setResponseCookieSpy).toHaveBeenCalledWith(mockResponse, 'authSessionId', 'dummyAuthSessionIdForTesting1234', maxAge, true);
    expect(setResponseCookieSpy).toHaveBeenCalledWith(mockResponse, 'signedInAs', sessionConfig.user_type, maxAge, false);
  });
});

describe('destroyAuthSession()', () => {
  it('should delete the auth session row with the specified auth session ID', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now() - hourMilliseconds, Date.now()]
    );

    await destroyAuthSession('dummyAuthSessionIdForTesting1234');

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE session_id = ?;`,
      ['dummyAuthSessionIdForTesting1234']
    );

    expect(deletedRows.length).toBe(0);
  });
});

describe('destroyAuthSession()', () => {
  it('should delete all auth sessions related to the specified user ID', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)}), (${generatePlaceHolders(5)}), (${generatePlaceHolders(5)});`,
      [
        'dummyAuthSessionIdForTesting1231', 1, 'account', Date.now() - hourMilliseconds, Date.now() - dayMilliseconds,
        'dummyAuthSessionIdForTesting1232', 1, 'account', Date.now() - hourMilliseconds, Date.now() - hourMilliseconds,
        'dummyAuthSessionIdForTesting1233', 1, 'account', Date.now() - hourMilliseconds, Date.now(),
      ]
    );

    await purgeAuthSessions(1, 'account');

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE user_id = ? AND user_type = ?;`,
      [1, 'account']
    );

    expect(deletedRows.length).toBe(0);
  });
});