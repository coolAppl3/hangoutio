import { handleWebSocketUpgrade, authenticateHandshake } from '../../../src/webSockets/hangout/hangoutWebSocketAuth';
import http, { IncomingMessage } from 'http';
import { Socket } from 'net';
import { dbPool } from '../../../src/db/db';
import { RowDataPacket } from 'mysql2';
import { generatePlaceHolders } from '../../../src/util/generatePlaceHolders';
import { dayMilliseconds, hourMilliseconds } from '../../../src/util/constants';

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

const mockReq = {
  url: '',
  headers: {
    cookie: '',
  },
} as unknown as IncomingMessage;

const mockSocket = {
  write: jest.fn(),
  end: jest.fn(),

  on: jest.fn(),
} as unknown as Socket;

const mockSocketWriteSpy = jest.spyOn(mockSocket, 'write');
const mockSocketEndSpy = jest.spyOn(mockSocket, 'end');

describe('handleWebSocketUpgrade()', () => {
  it(`should reject the upgrade request if the app's memory usage is beyond the allowed threshold`, async () => {
    jest.spyOn(process, 'memoryUsage').mockReturnValueOnce({
      rss: 1024 * 1024 * 600, // limit is mocked to 500 in the setup file
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0,
    });

    await handleWebSocketUpgrade(mockReq, mockSocket, Buffer.alloc(0));

    expect(mockSocketWriteSpy).toHaveBeenCalledTimes(2);
    expect(mockSocketWriteSpy).toHaveBeenCalledWith(`HTTP/1.1 ${http.STATUS_CODES[509]}\r\n\r\n`);
    expect(mockSocketWriteSpy).toHaveBeenCalledWith('Temporarily unavailable\r\n');

    expect(mockSocketEndSpy).toHaveBeenCalled();
  });

  it(`should reject the upgrade request if user's credentials are invalid`, async () => {
    await handleWebSocketUpgrade(mockReq, mockSocket, Buffer.alloc(0));

    expect(mockSocketWriteSpy).toHaveBeenCalledTimes(2);
    expect(mockSocketWriteSpy).toHaveBeenCalledWith(`HTTP/1.1 ${http.STATUS_CODES[401]}\r\n\r\n`);
    expect(mockSocketWriteSpy).toHaveBeenCalledWith('Invalid credentials\r\n');

    expect(mockSocketEndSpy).toHaveBeenCalled();
  });
});

describe('authenticateHandshake()', () => {
  afterEach(() => {
    mockReq.headers.cookie = '';
  });

  it('should return null if the upgrade request has no cookie object', async () => {
    mockReq.headers.cookie = undefined;

    const returnedValue = await authenticateHandshake(mockReq);
    expect(returnedValue).toBe(null);
  });

  it('should return null if the upgrade request does not contain an authSessionId cookie', async () => {
    const returnedValue = await authenticateHandshake(mockReq);
    expect(returnedValue).toBe(null);
  });

  it('should return null if the upgrade request contains an authSessionId cookie, but it is invalid', async () => {
    mockReq.headers.cookie = 'authSessionId=invalidId';

    const returnedValue = await authenticateHandshake(mockReq);
    expect(returnedValue).toBe(null);
  });

  it('should return null if the upgrade request does not contain a url string', async () => {
    mockReq.headers.cookie = 'authSessionId=dummyAuthSessionIdForTesting1234';
    mockReq.url = undefined;

    const returnedValue = await authenticateHandshake(mockReq);
    expect(returnedValue).toBe(null);
  });

  it('should return null if the upgrade request contains an empty url string', async () => {
    mockReq.headers.cookie = 'authSessionId=dummyAuthSessionIdForTesting1234';
    mockReq.url = '';

    const returnedValue = await authenticateHandshake(mockReq);
    expect(returnedValue).toBe(null);
  });

  it('should return null if the upgrade request url query string does not contain a hangout member Id and a hangout Id', async () => {
    mockReq.headers.cookie = 'authSessionId=dummyAuthSessionIdForTesting1234';

    async function testRequestUrl(queryString: string): Promise<void> {
      mockReq.url = `https://hangoutio.com?${queryString}`;

      const returnedValue = await authenticateHandshake(mockReq);
      expect(returnedValue).toBe(null);
    };

    await testRequestUrl('');
    await testRequestUrl('hangoutMemberId=1');
    await testRequestUrl('hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013');
  });

  it('should return null if the hangout member ID is invalid', async () => {
    mockReq.headers.cookie = 'authSessionId=dummyAuthSessionIdForTesting1234';

    async function testHangoutMemberId(hangoutMemberId: string): Promise<void> {
      mockReq.url = `https://hangoutio.com?hangoutMemberId=${hangoutMemberId}&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013`;

      const returnedValue = await authenticateHandshake(mockReq);
      expect(returnedValue).toBe(null);
    };

    await testHangoutMemberId('23.5');
    await testHangoutMemberId('white space');
    await testHangoutMemberId('!nv@l!d');
  });

  it('should return null if the hangout ID is invalid', async () => {
    mockReq.headers.cookie = 'authSessionId=dummyAuthSessionIdForTesting1234';

    async function testHangoutId(hangoutId: string): Promise<void> {
      mockReq.url = `https://hangoutio.com?hangoutMemberId=1&hangoutId=${hangoutId}`;

      const returnedValue = await authenticateHandshake(mockReq);
      expect(returnedValue).toBe(null);
    };

    await testHangoutId('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR');
    await testHangoutId('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013');
    await testHangoutId('1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR');
    await testHangoutId('1749132719013');
  });

  it(`should return null if the user's auth session is invalid`, async () => {
    mockReq.headers.cookie = 'authSessionId=dummyAuthSessionIdForTesting1234';
    mockReq.url = `https://hangoutio.com?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013`;

    const returnedValue = await authenticateHandshake(mockReq);
    expect(returnedValue).toBe(null);
  });

  it('should return null if the hangout is not found, or the user is not a member of it', async () => {
    mockReq.headers.cookie = 'authSessionId=dummyAuthSessionIdForTesting1234';
    mockReq.url = `https://hangoutio.com?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013`;

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const returnedValue = await authenticateHandshake(mockReq);
    expect(returnedValue).toBe(null);
  });

  it('should return the hangout member ID and hangout ID in an object if all the request is valid', async () => {
    mockReq.headers.cookie = 'authSessionId=dummyAuthSessionIdForTesting1234';
    mockReq.url = `https://hangoutio.com?hangoutMemberId=1&hangoutId=htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013`;

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

    const returnedValue = await authenticateHandshake(mockReq);
    expect(returnedValue).toEqual({ hangoutMemberId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });
  });
});