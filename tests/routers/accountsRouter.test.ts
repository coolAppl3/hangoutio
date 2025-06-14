import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';
import { ACCOUNT_VERIFICATION_WINDOW, dayMilliseconds, EMAILS_SENT_LIMIT, FAILED_ACCOUNT_UPDATE_LIMIT, FAILED_SIGN_IN_LIMIT, hourMilliseconds } from '../../src/util/constants';
import * as emailServices from '../../src/util/email/emailServices';
import { RowDataPacket } from 'mysql2';
import * as authSessionModule from '../../src/auth/authSessions';
import bcrypt from 'bcrypt';
import { generateAuthSessionId } from '../../src/util/tokenGenerator';
import * as cookeUtils from '../../src/util/cookieUtils';
import * as hangoutWebSocketServerModule from '../../src/webSockets/hangout/hangoutWebSocketServer';
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
const purgeAuthSessionsSpy = jest.spyOn(authSessionModule, 'purgeAuthSessions');
const sendHangoutWebSocketMessageSpy = jest.spyOn(hangoutWebSocketServerModule, 'sendHangoutWebSocketMessage');

describe('POST accounts/signUp', () => {
  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signUp')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signUp')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ email: 'someEmail@example.com', username: 'someUsername', displayName: 'John Doe' });
    await testKeys({ email: 'someEmail@example.com', username: 'someUsername', password: 'somePassword' });
    await testKeys({ email: 'someEmail@example.com', displayName: 'John Doe', password: 'somePassword' });
    await testKeys({ username: 'someUsername', displayName: 'John Doe', password: 'somePassword' });
    await testKeys({ username: 'someUsername', displayName: 'John Doe', password: 'somePassword', invalidKey: 'someValue' });
  });

  it('should reject requests with an invalid email', async () => {
    async function testEmail(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signUp')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid email address.');
      expect(response.body.reason).toBe('invalidEmail');
    };

    await testEmail({ email: 23, username: 'someUsername', displayName: 'John Doe', password: 'somePassword' });
    await testEmail({ email: '', username: 'someUsername', displayName: 'John Doe', password: 'somePassword' });
    await testEmail({ email: 'invalidStructure', username: 'someUsername', displayName: 'John Doe', password: 'somePassword' });
    await testEmail({ email: 'missingAtSymbol.com', username: 'someUsername', displayName: 'John Doe', password: 'somePassword' });
    await testEmail({ email: 'missingDot@invalid', username: 'someUsername', displayName: 'John Doe', password: 'somePassword' });
    await testEmail({ email: 'invalidD@invalid.k', username: 'someUsername', displayName: 'John Doe', password: 'somePassword' });
    await testEmail({ email: 'invalidD@invalid.ks.s', username: 'someUsername', displayName: 'John Doe', password: 'somePassword' });
    await testEmail({ email: 'invalidD@invalid.ks.sd.s', username: 'someUsername', displayName: 'John Doe', password: 'somePassword' });
  });

  it('should reject requests with an invalid username', async () => {
    async function testUsername(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signUp')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid username.');
      expect(response.body.reason).toBe('invalidUsername');
    };

    await testUsername({ email: 'example@example.com', username: 23, displayName: 'John Doe', password: 'somePassword' });
    await testUsername({ email: 'example@example.com', username: '', displayName: 'John Doe', password: 'somePassword' });
    await testUsername({ email: 'example@example.com', username: 'john', displayName: 'John Doe', password: 'somePassword' });
    await testUsername({ email: 'example@example.com', username: 'beyondTwentyFiveCharacters', displayName: 'John Doe', password: 'somePassword' });
    await testUsername({ email: 'example@example.com', username: 'invalidSymbols#$%^', displayName: 'John Doe', password: 'somePassword' });
  });

  it('should reject requests with an invalid display name', async () => {
    async function testDisplayName(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signUp')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid display name.');
      expect(response.body.reason).toBe('invalidDisplayName');
    };

    await testDisplayName({ email: 'example@example.com', username: 'someUsername', displayName: 23, password: 'somePassword' });
    await testDisplayName({ email: 'example@example.com', username: 'someUsername', displayName: '', password: 'somePassword' });
    await testDisplayName({ email: 'example@example.com', username: 'someUsername', displayName: 'Numbers 23', password: 'somePassword' });
    await testDisplayName({ email: 'example@example.com', username: 'someUsername', displayName: '_symbol$', password: 'somePassword' });
    await testDisplayName({ email: 'example@example.com', username: 'someUsername', displayName: 'Beyond Twenty Five Characters', password: 'somePassword' });
  });

  it('should reject requests with an invalid password', async () => {
    async function testPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signUp')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid password.');
      expect(response.body.reason).toBe('invalidPassword');
    };

    await testPassword({ email: 'example@example.com', username: 'johnDoe', displayName: 'John Doe', password: 23 });
    await testPassword({ email: 'example@example.com', username: 'johnDoe', displayName: 'John Doe', password: 'short' });
    await testPassword({ email: 'example@example.com', username: 'johnDoe', displayName: 'John Doe', password: 'beyondFortyCharactersForSomeIncrediblyWeirdReason' });
    await testPassword({ email: 'example@example.com', username: 'johnDoe', displayName: 'John Doe', password: 'has whitespace' });
    await testPassword({ email: 'example@example.com', username: 'johnDoe', displayName: 'John Doe', password: 'symbolOtherThanDotsAndUnderscores#%^@' });
  });

  it('should reject requests with identical username and password', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signUp')
      .send({ email: 'example@example.com', username: 'johnDoe23', displayName: 'John Doe', password: 'johnDoe23' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`Password can't be identical to username.`);
    expect(response.body.reason).toBe('passwordEqualsUsername');
  });

  it('should reject requests if the user is signed in', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signUp')
      .set('Cookie', 'authSessionId=someAuthSessionId')
      .send({ email: 'example@example.com', username: 'johnDoe23', displayName: 'John Doe', password: 'somePassword' });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`You must sign out before proceeding.`);
    expect(response.body.reason).toBe('signedIn');
  });

  it('should reject requests with a taken email', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example1@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 1, 'example2@example.com', 'someCode', Date.now() + dayMilliseconds, 1, 0]
    );

    async function testTakenEmail(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signUp')
        .send(requestData);

      expect(response.status).toBe(409);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe(`Email address is already taken.`);
      expect(response.body.reason).toBe('emailTaken');
    };

    await testTakenEmail({ email: 'example1@example.com', username: 'johnDoe23', displayName: 'John Doe', password: 'somePassword' });
    await testTakenEmail({ email: 'example2@example.com', username: 'johnDoe23', displayName: 'John Doe', password: 'somePassword' });
  });

  it('should reject requests with a taken username', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe1', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['someId', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)});`,
      [1, 'johnDoe2', 'somePassword', 'John Doe', 'someId']
    );

    async function testTakenUsername(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signUp')
        .send(requestData);

      expect(response.status).toBe(409);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe(`Username is already taken.`);
      expect(response.body.reason).toBe('usernameTaken');
    };

    await testTakenUsername({ email: 'example1@example.com', username: 'johnDoe1', displayName: 'John Doe', password: 'somePassword' });
    await testTakenUsername({ email: 'example1@example.com', username: 'johnDoe2', displayName: 'John Doe', password: 'somePassword' });
  });

  it('should reject requests with a taken email or username', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example1@example.com', 'someHashedPassword', 'johnDoe1', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 1, 'example2@example.com', 'someCode', Date.now() + dayMilliseconds, 1, 0]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['someId', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO guests VALUES (${generatePlaceHolders(5)});`,
      [1, 'johnDoe2', 'somePassword', 'John Doe', 'someId']
    );

    async function testTakenCredentials(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signUp')
        .send(requestData);

      expect(response.status).toBe(409);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe(`Email address and username are both already taken.`);
      expect(response.body.reason).toBe('emailAndUsernameTaken');
    };

    await testTakenCredentials({ email: 'example1@example.com', username: 'johnDoe1', displayName: 'John Doe', password: 'somePassword' });
    await testTakenCredentials({ email: 'example2@example.com', username: 'JohnDoe1', displayName: 'John Doe', password: 'somePassword' });
    await testTakenCredentials({ email: 'example1@example.com', username: 'JohnDoe2', displayName: 'John Doe', password: 'somePassword' });
    await testTakenCredentials({ email: 'example2@example.com', username: 'JohnDoe2', displayName: 'John Doe', password: 'somePassword' });
  });

  it('should accept the request, insert rows into the accounts and account_verification table, return the account ID and verification expiry timestamp, and send a verification email', async () => {
    const sendVerificationEmailSpy = jest.spyOn(emailServices, 'sendVerificationEmail');

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signUp')
      .send({ email: 'example@example.com', username: 'johnDoe23', displayName: 'John Doe', password: 'somePassword' });

    expect(response.status).toBe(201);

    expect(response.body).toHaveProperty('accountId');
    expect(response.body).toHaveProperty('verificationExpiryTimestamp');

    expect(typeof response.body.accountId).toBe('number');
    expect(typeof response.body.verificationExpiryTimestamp).toBe('number');

    expect(Number.isInteger(response.body.accountId)).toBe(true);
    expect(Number.isInteger(response.body.verificationExpiryTimestamp)).toBe(true);

    const [accountRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT account_id FROM accounts WHERE username = ?;`,
      ['johnDoe23']
    );

    const [accountVerificationRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM account_verification WHERE account_id = ?;`,
      [accountRows[0].account_id]
    );

    expect(accountRows.length).toBe(1);
    expect(accountVerificationRows.length).toBe(1);

    expect(sendVerificationEmailSpy).toHaveBeenCalled();
  });
});

describe('POST accounts/verification/resendEmail', () => {
  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/verification/resendEmail')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/verification/resendEmail')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ email: 'someEmail@example.com' });
    await testKeys({ username: 'someUsername', displayName: 'John Doe' });
  });

  it('should reject requests with an invalid account ID', async () => {
    async function testAccountId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/verification/resendEmail')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid account ID.');
      expect(response.body.reason).toBe('invalidAccountId');
    };

    await testAccountId({ accountId: 23.5 });
    await testAccountId({ accountId: 'someString' });
    await testAccountId({ accountId: NaN });
  });

  it('should reject requests if the user is signed in', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/verification/resendEmail')
      .set('Cookie', 'authSessionId=someAuthSessionId')
      .send({ accountId: 23 });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('You must sign out before proceeding.');
    expect(response.body.reason).toBe('signedIn');
  });

  it('should reject requests if the account is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/verification/resendEmail')
      .send({ accountId: 23 });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Account not found.');
  });

  it('should reject requests if the account already verified', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'somePassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/verification/resendEmail')
      .send({ accountId: 1 });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Account already verified.');
    expect(response.body.reason).toBe('alreadyVerified');
  });

  it('should reject requests if the verification request is not found', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'somePassword', 'johnDoe', 'John Doe', Date.now(), false, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/verification/resendEmail')
      .send({ accountId: 1 });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Verification request not found.');
  });

  it('should reject requests if the verification emails limit has been reached', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'somePassword', 'johnDoe', 'John Doe', Date.now(), false, 0]
    );

    await dbPool.execute(
      `INSERT INTO account_verification VALUES (${generatePlaceHolders(6)});`,
      [1, 1, 'someCode', EMAILS_SENT_LIMIT, 0, Date.now() + ACCOUNT_VERIFICATION_WINDOW]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/verification/resendEmail')
      .send({ accountId: 1 });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`Verification emails limit of ${EMAILS_SENT_LIMIT} reached.`);
    expect(response.body.reason).toBe('emailLimitReached');
  });

  it('should accept the request, update the count of emails sent in the table, return the updated count, and send a new verification email', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'somePassword', 'johnDoe', 'John Doe', Date.now(), false, 0]
    );

    await dbPool.execute(
      `INSERT INTO account_verification VALUES (${generatePlaceHolders(6)});`,
      [1, 1, 'someCode', 1, 0, Date.now() + ACCOUNT_VERIFICATION_WINDOW]
    );

    const sendVerificationEmailSpy = jest.spyOn(emailServices, 'sendVerificationEmail');

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/verification/resendEmail')
      .send({ accountId: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('verificationEmailsSent');
    expect(typeof response.body.verificationEmailsSent).toBe('number');
    expect(Number.isInteger(response.body.verificationEmailsSent)).toBe(true);
    expect(response.body.verificationEmailsSent).toBe(2);

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT verification_emails_sent FROM account_verification WHERE verification_id = ?;`,
      [1]
    );

    expect(updatedRows[0].verification_emails_sent).toBe(2);
    expect(sendVerificationEmailSpy).toHaveBeenCalled();
  });
});

describe('PATCH accounts/verification/verify', () => {
  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/verification/verify')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/verification/verify')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ accountId: 23 });
    await testKeys({ verificationCode: 'someCode' });
    await testKeys({ accountId: 23, someOtherKey: 'someValue' });
  });

  it('should reject requests with an invalid account ID', async () => {
    async function testAccountId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/verification/verify')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid account ID.');
      expect(response.body.reason).toBe('invalidAccountId');
    };

    await testAccountId({ accountId: null, verificationCode: 'ASDFGH' });
    await testAccountId({ accountId: '', verificationCode: 'ASDFGH' });
    await testAccountId({ accountId: '23', verificationCode: 'ASDFGH' });
    await testAccountId({ accountId: NaN, verificationCode: 'ASDFGH' });
    await testAccountId({ accountId: 2.4, verificationCode: 'ASDFGH' });
  });

  it('should reject requests with an invalid verification code', async () => {
    async function testVerificationCode(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/verification/verify')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid verification code.');
      expect(response.body.reason).toBe('invalidVerificationCode');
    };

    await testVerificationCode({ accountId: 23, verificationCode: null });
    await testVerificationCode({ accountId: 23, verificationCode: NaN });
    await testVerificationCode({ accountId: 23, verificationCode: '' });
    await testVerificationCode({ accountId: 23, verificationCode: '123' });
    await testVerificationCode({ accountId: 23, verificationCode: 'ASD' });
    await testVerificationCode({ accountId: 23, verificationCode: 'ASDFGHJK' });
  });

  it('should reject requests if the user is signed in', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/verification/verify')
      .set('Cookie', 'authSessionId=someAuthSessionId')
      .send({ accountId: 23, verificationCode: 'ASDFGH' });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('You must sign out before proceeding.');
    expect(response.body.reason).toBe('signedIn');
  });

  it('should reject requests if the account is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/verification/verify')
      .send({ accountId: 23, verificationCode: 'ASDFGH' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Account not found.');
  });

  it('should reject requests if the account is already verified', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)})`,
      [1, 'example@example.com', 'somePassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/verification/verify')
      .send({ accountId: 1, verificationCode: 'ASDFGH' });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Account already verified.');
  });

  it('should reject requests with an incorrect verification code and update the failed verification attempts count', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)})`,
      [1, 'example@example.com', 'somePassword', 'johnDoe', 'John Doe', Date.now(), false, 0]
    );

    await dbPool.execute(
      `INSERT INTO account_verification VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', 1, 0, Date.now() + dayMilliseconds]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/verification/verify')
      .send({ accountId: 1, verificationCode: 'ASDFGH' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect verification code.');
    expect(response.body.reason).toBe('incorrectCode');

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT failed_verification_attempts FROM account_verification WHERE verification_id = ?;`,
      [1]
    );

    expect(updatedRows[0].failed_verification_attempts).toBe(1);
  });

  it('should reject requests with an incorrect verification code, and if this is the failed verification limit has been reached, delete the account', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)})`,
      [1, 'example@example.com', 'somePassword', 'johnDoe', 'John Doe', Date.now(), false, 0]
    );

    await dbPool.execute(
      `INSERT INTO account_verification VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', 1, FAILED_ACCOUNT_UPDATE_LIMIT - 1, Date.now() + dayMilliseconds]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/verification/verify')
      .send({ accountId: 1, verificationCode: 'ASDFGH' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect verification code.');
    expect(response.body.reason).toBe('accountDeleted');

    const [removedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM accounts WHERE account_id = ?;`, [1]);
    expect(removedRows.length).toBe(0);
  });

  it('should accept the request, mark the account as verified, remove the relevant row from the account_verification table, create and auth session, and return a confirmation of whether an auth session was successfully created', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)})`,
      [1, 'example@example.com', 'somePassword', 'johnDoe', 'John Doe', Date.now(), false, 0]
    );

    await dbPool.execute(
      `INSERT INTO account_verification VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', 1, FAILED_ACCOUNT_UPDATE_LIMIT - 1, Date.now() + dayMilliseconds]
    );

    const createAuthSessionSpy = jest.spyOn(authSessionModule, 'createAuthSession');

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/verification/verify')
      .send({ accountId: 1, verificationCode: 'AAAAAA' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('authSessionCreated');
    expect(typeof response.body.authSessionCreated).toBe('boolean');

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT is_verified FROM accounts WHERE account_id = ?;`, [1]);
    expect(updatedRows[0].is_verified).toBe(1);

    const [removedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM account_verification WHERE verification_id = ?;`, [1]);
    expect(removedRows.length).toBe(0);

    expect(createAuthSessionSpy).toHaveBeenCalled();
  });
});

describe('POST accounts/signIn', () => {
  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signIn')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signIn')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ password: 'somePassword', keepSignedIn: true });
    await testKeys({ email: 'someEmail@example.com', keepSignedIn: true });
    await testKeys({ password: 'somePassword', keepSignedIn: true });
    await testKeys({ email: 'someEmail@example.com', password: 'somePassword', keepSignedIn: true, username: 'someUsername' });
  });

  it('should reject requests with an invalid email', async () => {
    async function testEmail(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signIn')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid email address.');
      expect(response.body.reason).toBe('invalidEmail');
    };

    await testEmail({ email: 23, password: 'somePassword', keepSignedIn: true, });
    await testEmail({ email: '', password: 'somePassword', keepSignedIn: true, });
    await testEmail({ email: 'invalid', password: 'somePassword', keepSignedIn: true, });
    await testEmail({ email: 'invalid@invalid', password: 'somePassword', keepSignedIn: true, });
    await testEmail({ email: 'invalid@invalid.23', password: 'somePassword', keepSignedIn: true, });
  });

  it('should reject requests with an invalid password', async () => {
    async function testPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signIn')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid account password.');
      expect(response.body.reason).toBe('invalidPassword');
    };

    await testPassword({ email: 'example@example.com', password: 23, keepSignedIn: true, });
    await testPassword({ email: 'example@example.com', password: '', keepSignedIn: true, });
    await testPassword({ email: 'example@example.com', password: 'white space', keepSignedIn: true, });
    await testPassword({ email: 'example@example.com', password: 'passwordIsLongerThanTwentyFourCharactersTotal', keepSignedIn: true, });
  });

  it('should reject requests if the account is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signIn')
      .send({ email: 'example@example.com', password: 'somePassword', keepSignedIn: true, });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Account not found.');
  });

  it('should reject requests if the account is locked', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 5]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signIn')
      .send({ email: 'example@example.com', password: 'somePassword', keepSignedIn: true, });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Account locked.');
    expect(response.body.reason).toBe('accountLocked');
  });

  it('should reject requests if the account is unverified', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'somePassword', 'johnDoe', 'John Doe', Date.now(), false, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signIn')
      .send({ email: 'example@example.com', password: 'somePassword', keepSignedIn: true, });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Account unverified.');
    expect(response.body.reason).toBe('accountUnverified');
  });

  it('should reject requests if the password is incorrect', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signIn')
      .send({ email: 'example@example.com', password: 'incorrectPassword', keepSignedIn: true, });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect password.');
    expect(response.body.reason).toBe('incorrectPassword');
  });

  it('should reject requests if the password is incorrect, and lock the failed sign in attempts limit has been reached', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 4]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signIn')
      .send({ email: 'example@example.com', password: 'incorrectPassword', keepSignedIn: true, });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect password. Account has been locked.');
    expect(response.body.reason).toBe('accountLocked');
  });

  it('should accept the request if the password is correct, reset the count of failed sign in attempts count, and create an auth session for the user', async () => {
    const hashedPassword: string = await bcrypt.hash('correctPassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 3]
    );

    const createAuthSessionSpy = jest.spyOn(authSessionModule, 'createAuthSession');

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signIn')
      .send({ email: 'example@example.com', password: 'correctPassword', keepSignedIn: true });

    expect(response.status).toBe(200);
    expect(createAuthSessionSpy).toHaveBeenCalled();

    const [updateRows] = await dbPool.execute<RowDataPacket[]>('SELECT failed_sign_in_attempts FROM accounts WHERE account_id = ?;', [1]);
    expect(updateRows[0].failed_sign_in_attempts).toBe(0);
  });
});

describe('POST accounts/recovery/start', () => {
  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/start')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/recovery/start')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ someRandomValue: true });
    await testKeys({ anotherRandomValue: 23 });
  });

  it('should reject requests with an invalid email', async () => {
    async function testEmail(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/recovery/start')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid email address.');
      expect(response.body.reason).toBe('invalidEmail');
    };

    await testEmail({ email: 23 });
    await testEmail({ email: '' });
    await testEmail({ email: 'invalid@invalid.23' });
  });

  it('should reject requests if the user is signed in', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/start')
      .set('Cookie', 'authSessionId=someAuthSessionId')
      .send({ email: 'example@example.com' });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('You must sign out before proceeding.');
    expect(response.body.reason).toBe('signedIn');
  });

  it('should reject requests if the account is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/start')
      .send({ email: 'example@example.com' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Account not found.');
  });

  it('should reject requests if the account is unverified', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), false, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/start')
      .send({ email: 'example@example.com' });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`Can't recover an unverified account.`);
    expect(response.body.reason).toBe('accountUnverified');
  });

  it('should reject requests if an existing recovery request is found, but too many failed recovery attempts have been made, returning the account recovery request expiry timestamp', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const dummyExpiryTimestamp: number = Date.now() + dayMilliseconds;
    await dbPool.execute(
      `INSERT INTO account_recovery VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', dummyExpiryTimestamp, 1, FAILED_ACCOUNT_UPDATE_LIMIT]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/start')
      .send({ email: 'example@example.com' });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`Recovery suspended.`);
    expect(response.body.reason).toBe('recoverySuspended');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(typeof response.body.resData.expiryTimestamp).toBe('number');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
    expect(response.body.resData.expiryTimestamp).toBe(dummyExpiryTimestamp);
  });

  it(`should reject requests if an existing recovery request is found, and if the user hasn't had too many failed recovery attempts, return the account recovery timestamp alongside the account ID`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const dummyExpiryTimestamp: number = Date.now() + dayMilliseconds;
    await dbPool.execute(
      `INSERT INTO account_recovery VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', dummyExpiryTimestamp, 1, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/start')
      .send({ email: 'example@example.com' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`Ongoing recovery request found.`);
    expect(response.body.reason).toBe('ongoingRequest');

    expect(response.body).toHaveProperty('resData');

    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(response.body.resData).toHaveProperty('accountId');

    expect(typeof response.body.resData.expiryTimestamp).toBe('number');
    expect(typeof response.body.resData.accountId).toBe('number');

    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
    expect(Number.isInteger(response.body.resData.accountId)).toBe(true);

    expect(response.body.resData.expiryTimestamp).toBe(dummyExpiryTimestamp);
    expect(response.body.resData.accountId).toBe(1);
  });

  it('should accept the request if there are no ongoing account recovery requests or suspensions, insert a row into the account_recovery table, return both the account ID and request expiry timestamp, and send a recovery email', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const sendRecoveryEmailSpy = jest.spyOn(emailServices, 'sendRecoveryEmail');

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/start')
      .send({ email: 'example@example.com' });

    expect(response.status).toBe(201);

    expect(response.body).toHaveProperty('accountId');
    expect(response.body).toHaveProperty('expiryTimestamp');

    expect(typeof response.body.accountId).toBe('number');
    expect(typeof response.body.expiryTimestamp).toBe('number');

    expect(Number.isInteger(response.body.accountId)).toBe(true);
    expect(Number.isInteger(response.body.expiryTimestamp)).toBe(true);

    expect(response.body.accountId).toBe(1);
    expect(sendRecoveryEmailSpy).toHaveBeenCalled();

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM account_recovery WHERE account_id = ?;`, [1]);
    expect(createdRows.length).toBe(1);
  });
});

describe('POST accounts/recovery/resendEmail', () => {
  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/resendEmail')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/recovery/resendEmail')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ someRandomValue: true });
    await testKeys({ anotherRandomValue: 23 });
  });

  it('should reject requests with an invalid account ID', async () => {
    async function testAccountId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/recovery/resendEmail')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Invalid account ID.');
    };

    await testAccountId({ accountId: true });
    await testAccountId({ accountId: NaN });
    await testAccountId({ accountId: '' });
    await testAccountId({ accountId: 'string' });
    await testAccountId({ accountId: 23.5 });
  });

  it('should reject requests if the account is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/resendEmail')
      .send({ accountId: 23 });

    expect(response.status).toBe(404);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Account not found.');
    expect(response.body.reason).toBe('accountNotFound');
  });

  it('should reject requests if the recovery request is not found', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/resendEmail')
      .send({ accountId: 1 });

    expect(response.status).toBe(404);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Recovery request not found or may have expired.');
    expect(response.body.reason).toBe('requestNotFound');
  });

  it('should reject requests if an existing recovery request is found, but too many failed recovery attempts have been made, returning the account recovery request expiry timestamp', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const dummyExpiryTimestamp: number = Date.now() + dayMilliseconds;
    await dbPool.execute(
      `INSERT INTO account_recovery VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', dummyExpiryTimestamp, 1, FAILED_ACCOUNT_UPDATE_LIMIT]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/resendEmail')
      .send({ accountId: 1 });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`Recovery suspended.`);
    expect(response.body.reason).toBe('recoverySuspended');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(typeof response.body.resData.expiryTimestamp).toBe('number');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
    expect(response.body.resData.expiryTimestamp).toBe(dummyExpiryTimestamp);
  });

  it('should reject requests if an existing recovery request is found, but the email limit has been reached', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO account_recovery VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + hourMilliseconds, EMAILS_SENT_LIMIT, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/resendEmail')
      .send({ accountId: 1 });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`Recovery emails limit of ${EMAILS_SENT_LIMIT} reached.`);
    expect(response.body.reason).toBe('limitReached');
  });

  it('should accept the request, update the value of recovery_emails_sent in the table, and resend the recovery email', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO account_recovery VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + hourMilliseconds, 1, 0]
    );

    const resendRecoveryEmailSpy = jest.spyOn(emailServices, 'sendRecoveryEmail');

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/resendEmail')
      .send({ accountId: 1 });

    expect(response.status).toBe(200);
    expect(resendRecoveryEmailSpy).toHaveBeenCalled();

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT recovery_emails_sent FROM account_recovery WHERE account_id = ?;`,
      [1]
    );

    expect(updatedRows[0].recovery_emails_sent).toBe(2);
  });
});

describe('PATCH accounts/recovery/updatePassword', () => {
  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/recovery/updatePassword')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/recovery/updatePassword')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });
    await testKeys({ accountId: 23, newPassword: 'someNewPassword' });
    await testKeys({ accountId: 23, recoveryCode: 'AAAAAA', });
    await testKeys({ accountId: 23, recoveryCode: 'AAAAAA', someRandomValue: 'someValue' });
  });

  it('should reject requests with an invalid account ID', async () => {
    async function testAccountId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/recovery/updatePassword')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Invalid account ID.');
    };

    await testAccountId({ accountId: null, recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });
    await testAccountId({ accountId: NaN, recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });
    await testAccountId({ accountId: '', recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });
    await testAccountId({ accountId: 'invalid', recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });
    await testAccountId({ accountId: '23', recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });
    await testAccountId({ accountId: 23.5, recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });
  });

  it('should reject requests with an invalid recovery code', async () => {
    async function testRecoveryCode(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/recovery/updatePassword')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid recovery code.');
      expect(response.body.reason).toBe('invalidRecoveryCode');
    };

    await testRecoveryCode({ accountId: 23, recoveryCode: null, newPassword: 'someNewPassword' });
    await testRecoveryCode({ accountId: 23, recoveryCode: NaN, newPassword: 'someNewPassword' });
    await testRecoveryCode({ accountId: 23, recoveryCode: 23, newPassword: 'someNewPassword' });
    await testRecoveryCode({ accountId: 23, recoveryCode: 23.5, newPassword: 'someNewPassword' });
    await testRecoveryCode({ accountId: 23, recoveryCode: 'AA', newPassword: 'someNewPassword' });
    await testRecoveryCode({ accountId: 23, recoveryCode: 'AAAAAAAA', newPassword: 'someNewPassword' });
    await testRecoveryCode({ accountId: 23, recoveryCode: 'AAA_AAA', newPassword: 'someNewPassword' });
  });

  it('should reject requests with an invalid new password', async () => {
    async function testNewPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/recovery/updatePassword')
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid new password.');
      expect(response.body.reason).toBe('invalidPassword');
    };

    await testNewPassword({ accountId: 23, recoveryCode: 'AAAAAA', newPassword: null });
    await testNewPassword({ accountId: 23, recoveryCode: 'AAAAAA', newPassword: NaN });
    await testNewPassword({ accountId: 23, recoveryCode: 'AAAAAA', newPassword: '' });
    await testNewPassword({ accountId: 23, recoveryCode: 'AAAAAA', newPassword: 'short' });
    await testNewPassword({ accountId: 23, recoveryCode: 'AAAAAA', newPassword: 'passwordIsLongerThanTwentyFourCharactersTotal' });
    await testNewPassword({ accountId: 23, recoveryCode: 'AAAAAA', newPassword: 'illegal-$ymbols&*' });
  });

  it('should reject requests if the user is signed in', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/recovery/updatePassword')
      .set('Cookie', 'authSessionId=someAuthSessionId')
      .send({ accountId: 23, recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`You can't recover an account while signed in.`);
    expect(response.body.reason).toBe('signedIn');
  });

  it('should reject requests if the recovery request is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/recovery/updatePassword')
      .send({ accountId: 23, recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Recovery request not found.');
  });

  it('should reject requests if the recovery request is suspended and return the recovery request expiry timestamp', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const dummyExpiryTimestamp: number = Date.now() + dayMilliseconds;
    await dbPool.execute(
      `INSERT INTO account_recovery VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', dummyExpiryTimestamp, 1, FAILED_ACCOUNT_UPDATE_LIMIT]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/recovery/updatePassword')
      .send({ accountId: 1, recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });

    expect(response.status).toBe(403);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Recovery suspended.');
    expect(response.body.reason).toBe('recoverySuspended');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(typeof response.body.resData.expiryTimestamp).toBe('number');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
    expect(response.body.resData.expiryTimestamp).toBe(dummyExpiryTimestamp);
  });

  it('should reject requests if the recovery code is incorrect and update the failed_recovery_attempts count in the table', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO account_recovery VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + hourMilliseconds, 1, 0]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/recovery/updatePassword')
      .send({ accountId: 1, recoveryCode: 'BBBBBB', newPassword: 'someNewPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect recovery code.');
    expect(response.body.reason).toBe('incorrectRecoveryCode');

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT failed_recovery_attempts FROM account_recovery WHERE account_id = ?;`,
      [1]
    );

    expect(updatedRows[0].failed_recovery_attempts).toBe(1);
  });

  it('should reject requests if the recovery code is incorrect, update the failed_recovery_attempts count in the table, and if the user has reached the failed recovery attempts limit, suspend the recovery request', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    const dummyExpiryTimestamp: number = Date.now() + dayMilliseconds;
    await dbPool.execute(
      `INSERT INTO account_recovery VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', dummyExpiryTimestamp, 1, FAILED_ACCOUNT_UPDATE_LIMIT - 1]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/recovery/updatePassword')
      .send({ accountId: 1, recoveryCode: 'BBBBBB', newPassword: 'someNewPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect recovery code.');
    expect(response.body.reason).toBe('recoverySuspended');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(typeof response.body.resData.expiryTimestamp).toBe('number');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
    expect(response.body.resData.expiryTimestamp).toBe(dummyExpiryTimestamp);

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT failed_recovery_attempts FROM account_recovery WHERE account_id = ?;`,
      [1]
    );

    expect(updatedRows[0].failed_recovery_attempts).toBe(FAILED_ACCOUNT_UPDATE_LIMIT);
  });

  it(`should reject requests if the recovery code is correct, but the new password is identical to the account's username`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe23', 'John Doe', Date.now(), true, 0]
    );

    const dummyExpiryTimestamp: number = Date.now() + dayMilliseconds;
    await dbPool.execute(
      `INSERT INTO account_recovery VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', dummyExpiryTimestamp, 1, FAILED_ACCOUNT_UPDATE_LIMIT - 1]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/recovery/updatePassword')
      .send({ accountId: 1, recoveryCode: 'AAAAAA', newPassword: 'johnDoe23' });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe(`New password can't be identical to username.`);
  });

  it(`should accept the request if the recovery code is correct, update the values of hashed_password and failed_sign_in_attempts in the accounts table, delete the recovery request from the account_recovery table, and create auth session for the user`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 3]
    );

    const dummyExpiryTimestamp: number = Date.now() + dayMilliseconds;
    await dbPool.execute(
      `INSERT INTO account_recovery VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', dummyExpiryTimestamp, 1, FAILED_ACCOUNT_UPDATE_LIMIT - 1]
    );

    const createAuthSessionSpy = jest.spyOn(authSessionModule, 'createAuthSession');

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/recovery/updatePassword')
      .send({ accountId: 1, recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });

    expect(response.status).toBe(200);
    expect(createAuthSessionSpy).toHaveBeenCalled();

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
        hashed_password,
        failed_sign_in_attempts
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [1]
    );

    const passwordUpdatedCorrectly: boolean = await bcrypt.compare('someNewPassword', updatedRows[0].hashed_password);

    expect(passwordUpdatedCorrectly).toBe(true);
    expect(updatedRows[0].failed_sign_in_attempts).toBe(0);

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(`SELECT 1 FROM account_recovery WHERE account_id = ?;`, [1]);
    expect(deletedRows.length).toBe(0);
  });
});

describe('PATCH accounts/details/updateDisplayName', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateDisplayName')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message === 'string').toBe(true);
    expect(typeof response.body.reason === 'string').toBe(true);

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateDisplayName')
      .set('Cookie', `authSessionId=invalidId`)
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message === 'string').toBe(true);
    expect(typeof response.body.reason === 'string').toBe(true);

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateDisplayName')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/details/updateDisplayName')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ newDisplayName: 'Sara Smith' });
    await testKeys({ password: 'somePassword' });
    await testKeys({ password: 'somePassword', someRandomValue: 'someString' });
  });

  it('should reject requests with an invalid password', async () => {
    async function testPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/details/updateDisplayName')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid password.');
      expect(response.body.reason).toBe('invalidPassword');
    };

    await testPassword({ password: 23, newDisplayName: 'Sara Smith' });
    await testPassword({ password: '', newDisplayName: 'Sara Smith' });
    await testPassword({ password: 'white space', newDisplayName: 'Sara Smith' });
    await testPassword({ password: 'passwordIsLongerThanTwentyFourCharactersTotal', newDisplayName: 'Sara Smith' });
  });

  it('should reject requests with an invalid display name', async () => {
    async function testDisplayName(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/details/updateDisplayName')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid display name.');
      expect(response.body.reason).toBe('invalidDisplayName');
    };

    await testDisplayName({ password: 'somePassword', newDisplayName: null });
    await testDisplayName({ password: 'somePassword', newDisplayName: NaN });
    await testDisplayName({ password: 'somePassword', newDisplayName: 23 });
    await testDisplayName({ password: 'somePassword', newDisplayName: 23.5 });
    await testDisplayName({ password: 'somePassword', newDisplayName: '' });
    await testDisplayName({ password: 'somePassword', newDisplayName: 'Beyond Twenty Five Characters' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateDisplayName')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newDisplayName: 'Sara Smith' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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
      .patch('/api/accounts/details/updateDisplayName')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newDisplayName: 'Sara Smith' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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
      .patch('/api/accounts/details/updateDisplayName')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newDisplayName: 'Sara Smith' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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

  it(`should reject requests if the password is incorrect`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateDisplayName')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newDisplayName: 'Sara Smith' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect password.');
    expect(response.body.reason).toBe('incorrectPassword');
  });

  it(`should reject requests if the password is incorrect, and if failed sign in attempts limit is reached, lock the account, remove the authSessionId cookie, and purge all auth sessions related to the user`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, FAILED_SIGN_IN_LIMIT - 1]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting5678', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateDisplayName')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newDisplayName: 'Sara Smith' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect password. Account has been locked.');
    expect(response.body.reason).toBe('accountLocked')

    expect(purgeAuthSessionsSpy).toHaveBeenCalled();
    expect(removeRequestCookieSpy).toHaveBeenCalled();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE user_id = ? AND user_type = ?;`,
      [1, 'account']
    );

    expect(deletedRows.length).toBe(0);
  });

  it(`should reject requests if the new display name is identical to the user's existing display name`, async () => {
    const hashedPassword: string = await bcrypt.hash('someHashedPassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, FAILED_SIGN_IN_LIMIT - 1]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateDisplayName')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'someHashedPassword', newDisplayName: 'John Doe' });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Your display name is already John Doe.');
  });

  it(`should accept the request, update the user's display name alongside any hangout member rows related to them, insert an en event for every hangout the user is a part of, and send a websocket message to add the event in real time`, async () => {
    const hashedPassword: string = await bcrypt.hash('someHashedPassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, FAILED_SIGN_IN_LIMIT - 1]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      ['someHangoutId', 'someTitle', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, Date.now(), Date.now(), false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES(${generatePlaceHolders(8)});`,
      [1, 'someHangoutId', 'johnDoe', 'account', 1, null, 'John Doe', false]
    );

    const addHangoutEventSpy = jest.spyOn(addHangoutEventModule, 'addHangoutEvent');

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateDisplayName')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'someHashedPassword', newDisplayName: 'Sara Smith' });

    expect(response.status).toBe(200);

    const [updatedAccountRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT display_name FROM accounts WHERE account_id = ?;`,
      [1]
    );

    const [updatedHangoutMemberRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT display_name FROM hangout_members WHERE account_id = ?;`,
      [1]
    );

    expect(updatedAccountRows[0].display_name).toBe('Sara Smith');
    expect(updatedHangoutMemberRows[0].display_name).toBe('Sara Smith');

    expect(addHangoutEventSpy).toHaveBeenCalled();
    expect(sendHangoutWebSocketMessageSpy).toHaveBeenCalled();
  });
});

describe('PATCH accounts/details/updatePassword', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updatePassword')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message === 'string').toBe(true);
    expect(typeof response.body.reason === 'string').toBe(true);

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updatePassword')
      .set('Cookie', `authSessionId=invalidId`)
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message === 'string').toBe(true);
    expect(typeof response.body.reason === 'string').toBe(true);

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updatePassword')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/details/updatePassword')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message === 'string').toBe(true);
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ currentPassword: 'somePassword', newPassword: 'someNewPassword', someRandomValue: 23 });
    await testKeys({ newPassword: 'someNewPassword' });
    await testKeys({ currentPassword: 'somePassword' });
  });

  it('should reject requests with an invalid current password', async () => {
    async function testCurrentPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/details/updatePassword')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message === 'string').toBe(true);
      expect(typeof response.body.reason === 'string').toBe(true);

      expect(response.body.message).toBe('Invalid password.');
      expect(response.body.reason).toBe('invalidCurrentPassword');
    };

    await testCurrentPassword({ currentPassword: null, newPassword: 'someNewPassword' });
    await testCurrentPassword({ currentPassword: NaN, newPassword: 'someNewPassword' });
    await testCurrentPassword({ currentPassword: 23, newPassword: 'someNewPassword' });
    await testCurrentPassword({ currentPassword: '', newPassword: 'someNewPassword' });
    await testCurrentPassword({ currentPassword: 'white space', newPassword: 'someNewPassword' });
    await testCurrentPassword({ currentPassword: 'passwordIsLongerThanTwentyFourCharactersTotal', newPassword: 'someNewPassword' });
  });

  it('should reject requests with an invalid new password', async () => {
    async function testNewPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/details/updatePassword')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message === 'string').toBe(true);
      expect(typeof response.body.reason === 'string').toBe(true);

      expect(response.body.message).toBe('Invalid new password.');
      expect(response.body.reason).toBe('invalidNewPassword');
    };

    await testNewPassword({ currentPassword: 'somePassword', newPassword: null });
    await testNewPassword({ currentPassword: 'somePassword', newPassword: NaN });
    await testNewPassword({ currentPassword: 'somePassword', newPassword: 23 });
    await testNewPassword({ currentPassword: 'somePassword', newPassword: '' });
    await testNewPassword({ currentPassword: 'somePassword', newPassword: 'white space' });
    await testNewPassword({ currentPassword: 'somePassword', newPassword: 'passwordIsLongerThanTwentyFourCharactersTotal' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ currentPassword: 'somePassword', newPassword: 'someNewPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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
      .patch('/api/accounts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ currentPassword: 'somePassword', newPassword: 'someNewPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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
      .patch('/api/accounts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ currentPassword: 'somePassword', newPassword: 'someNewPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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

  it('should reject requests if the password is incorrect', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ currentPassword: 'incorrectPassword', newPassword: 'someNewPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect password.');
    expect(response.body.reason).toBe('incorrectPassword');
  });

  it('should reject requests if the password is incorrect, and if failed sign in attempts limit is reached, lock the account, remove the authSessionId cookie, and purge all auth sessions related to the user', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, FAILED_SIGN_IN_LIMIT - 1]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting5678', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ currentPassword: 'incorrectPassword', newPassword: 'someNewPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect password. Account has been locked.');
    expect(response.body.reason).toBe('accountLocked');

    expect(purgeAuthSessionsSpy).toHaveBeenCalled();
    expect(removeRequestCookieSpy).toHaveBeenCalled();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE session_id = ?;`,
      ['dummyAuthSessionIdForTesting1234']
    );

    expect(deletedRows.length).toBe(0);
  });

  it('should reject requests if the new password is identical to the current one', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ currentPassword: 'somePassword', newPassword: 'somePassword' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`New password can't be identical to your current password.`);
    expect(response.body.reason).toBe('identicalPasswords');
  });

  it('should reject requests if the new password is identical to the current one', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe23', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ currentPassword: 'somePassword', newPassword: 'johnDoe23' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe(`New password can't be identical to your username.`);
    expect(response.body.reason).toBe('passwordEqualsUsername');
  });

  it(`should accept the request, update the user's password, purge all of the user's existing auth sessions, attempt to create a new one, then return a value to confirm if the creating a new auth session was successful`, async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const createAuthSessionSpy = jest.spyOn(authSessionModule, 'createAuthSession');

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updatePassword')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ currentPassword: 'somePassword', newPassword: 'someNewPassword' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('authSessionCreated');
    expect(typeof response.body.authSessionCreated).toBe('boolean');

    expect(purgeAuthSessionsSpy).toHaveBeenCalled();
    expect(createAuthSessionSpy).toHaveBeenCalled();
  });
});

describe('POST accounts/details/updateEmail/start', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message === 'string').toBe(true);
    expect(typeof response.body.reason === 'string').toBe(true);

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=invalidId`)
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message === 'string').toBe(true);
    expect(typeof response.body.reason === 'string').toBe(true);

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests with an empty body', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/details/updateEmail/start')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.message === 'string').toBe(true);
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ password: 'somePassword', newEmail: 'example@example.com', someRandomValue: 23 });
    await testKeys({ newEmail: 'example@example.com' });
    await testKeys({ password: 'somePassword' });
  });

  it('should reject requests with and invalid password', async () => {
    async function testPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/details/updateEmail/start')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid password.');
      expect(response.body.reason).toBe('invalidPassword');
    };

    await testPassword({ password: 23, newEmail: 'example@example.com' });
    await testPassword({ password: '', newEmail: 'example@example.com' });
    await testPassword({ password: 'white space', newEmail: 'example@example.com' });
    await testPassword({ password: 'passwordIsLongerThanTwentyFourCharactersTotal', newEmail: 'example@example.com' });
  });

  it('should reject requests with and invalid new email', async () => {
    async function testNewEmail(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/details/updateEmail/start')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.reason).toBe('string');

      expect(response.body.message).toBe('Invalid email address.');
      expect(response.body.reason).toBe('invalidEmail');
    };

    await testNewEmail({ password: 'somePassword', newEmail: null });
    await testNewEmail({ password: 'somePassword', newEmail: NaN });
    await testNewEmail({ password: 'somePassword', newEmail: 23 });
    await testNewEmail({ password: 'somePassword', newEmail: '' });
    await testNewEmail({ password: 'somePassword', newEmail: 'invalid' });
    await testNewEmail({ password: 'somePassword', newEmail: 'invalid@' });
    await testNewEmail({ password: 'somePassword', newEmail: 'invalid@invalid' });
    await testNewEmail({ password: 'somePassword', newEmail: 'invalid.com' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newEmail: 'example@example.com' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newEmail: 'example@example.com' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newEmail: 'example@example.com' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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

  it('should reject requests if the password is incorrect', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'incorrectPassword', newEmail: 'example@example.com' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect password.');
    expect(response.body.reason).toBe('incorrectPassword');
  });

  it('should reject requests if the password is incorrect, and if failed sign in attempts limit is reached, lock the account, remove the authSessionId cookie, and purge all auth sessions related to the user', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, FAILED_SIGN_IN_LIMIT - 1]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting5678', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'incorrectPassword', newEmail: 'example@example.com' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Incorrect password. Account has been locked.');
    expect(response.body.reason).toBe('accountLocked');

    expect(purgeAuthSessionsSpy).toHaveBeenCalled();
    expect(removeRequestCookieSpy).toHaveBeenCalled();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM auth_sessions WHERE session_id = ?;`,
      ['dummyAuthSessionIdForTesting1234']
    );

    expect(deletedRows.length).toBe(0);
  });

  it('should reject requests if an email update request is found, but the request was suspended, returning the expiry timestamp of the ongoing request', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 1, 'example@example.com', 'AAAAAA', Date.now() + dayMilliseconds, 1, FAILED_ACCOUNT_UPDATE_LIMIT]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newEmail: 'example@example.com' });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Request was suspended due to too many failed attempts.');

    expect(response.body).toHaveProperty('resData');
    expect(typeof response.body.resData).toBe('object');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(typeof response.body.resData.expiryTimestamp).toBe('number');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
  });

  it('should reject requests if an email update request is found, returning the expiry timestamp of the ongoing request', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 1, 'example@example.com', 'AAAAAA', Date.now() + dayMilliseconds, 1, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newEmail: 'example@example.com' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Ongoing email update request found.');
    expect(response.body.reason).toBe('ongoingRequest');

    expect(response.body).toHaveProperty('resData');
    expect(typeof response.body.resData).toBe('object');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(typeof response.body.resData.expiryTimestamp).toBe('number');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
  });

  it('should reject requests if an ongoing account deletion request is found', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO account_deletion VALUES (${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + dayMilliseconds, 1, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newEmail: 'example@example.com' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Account deletion request found.');
    expect(response.body.reason).toBe('ongoingAccountDeletion');
  });

  it('should reject requests if the new email is identical to the existing email', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newEmail: 'example@example.com' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('This email is already assigned to your account.');
    expect(response.body.reason).toBe('identicalEmail');
  });

  it('should reject requests if the new email is already taken by another user', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'existing@example.com', hashedPassword, 'johnDoe1', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [2, 'new@example.com', hashedPassword, 'johnDoe2', 'John Doe', Date.now(), true, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newEmail: 'new@example.com' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Email address is already taken.');
    expect(response.body.reason).toBe('emailTaken');
  });

  it('should reject requests if the new email is a part of an another email update request by another user', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'existing@example.com', hashedPassword, 'johnDoe1', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [2, 'other@example.com', hashedPassword, 'johnDoe2', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 2, 'new@example.com', 'AAAAAA', Date.now() + dayMilliseconds, 1, 0]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newEmail: 'new@example.com' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

    expect(response.body.message).toBe('Email address is already taken.');
    expect(response.body.reason).toBe('emailTaken');
  });

  it('should accept the request, generate  inserting a row into the email_update table, and sending an email-update email', async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'existing@example.com', hashedPassword, 'johnDoe1', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const sendEmailUpdateEmailSpy = jest.spyOn(emailServices, 'sendEmailUpdateEmail');

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/details/updateEmail/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword', newEmail: 'new@example.com' });

    expect(response.status).toBe(200);
    expect(sendEmailUpdateEmailSpy).toHaveBeenCalled();
  });
});

describe('GET accounts/details/updateEmail/resendEmail', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/details/updateEmail/resendEmail')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message === 'string').toBe(true);
    expect(typeof response.body.reason === 'string').toBe(true);

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/details/updateEmail/resendEmail')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message === 'string').toBe(true);
    expect(typeof response.body.reason === 'string').toBe(true);

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/details/updateEmail/resendEmail')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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
      .get('/api/accounts/details/updateEmail/resendEmail')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(typeof response.body.message).toBe('string');
    expect(typeof response.body.reason).toBe('string');

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

  it(`should reject requests if the email update request is not found`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/details/updateEmail/resendEmail')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Email update request not found or may have expired.');
  });

  it(`should reject requests if the email update request is found but too many failed attempts have been made, returning the request's expiry timestamp`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 1, 'example2@example.com', 'someCode', Date.now() + dayMilliseconds, 1, FAILED_ACCOUNT_UPDATE_LIMIT]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/details/updateEmail/resendEmail')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Request is suspended due to too many failed attempts.');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(typeof response.body.resData.expiryTimestamp).toBe('number');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
  });

  it('should reject requests if the email update request is found, but the sent emails limit has been reached', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 1, 'example2@example.com', 'someCode', Date.now() + dayMilliseconds, EMAILS_SENT_LIMIT, 0]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/details/updateEmail/resendEmail')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe(`Confirmation emails limit of ${EMAILS_SENT_LIMIT} reached.`);
  });

  it('should accept the request, update the count of emails sent in the table, then send another email update email', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 1, 'example2@example.com', 'someCode', Date.now() + dayMilliseconds, 1, 0]
    );

    const sendEmailUpdateEmailSpy = jest.spyOn(emailServices, 'sendEmailUpdateEmail');

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/details/updateEmail/resendEmail')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);
    expect(sendEmailUpdateEmailSpy).toHaveBeenCalled();

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT update_emails_sent FROM email_update WHERE account_id = ?;`,
      [1]
    );

    expect(updatedRows[0].update_emails_sent).toBe(2);
  });
});