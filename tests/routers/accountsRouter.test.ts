import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';
import { ACCOUNT_VERIFICATION_WINDOW, dayMilliseconds, EMAILS_SENT_LIMIT, FAILED_ACCOUNT_UPDATE_LIMIT, FAILED_SIGN_IN_LIMIT, hourMilliseconds } from '../../src/util/constants';
import * as emailServices from '../../src/util/email/emailServices';
import { RowDataPacket } from 'mysql2';
import * as authSessionModule from '../../src/auth/authSessions';
import bcrypt from 'bcrypt';
import { generateAuthSessionId, generateHangoutId } from '../../src/util/tokenGenerator';
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
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signUp')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
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
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/verification/resendEmail')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
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

    expect(response.body.message).toBe('You must sign out before proceeding.');
    expect(response.body.reason).toBe('signedIn');
  });

  it('should reject requests if the account is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/verification/resendEmail')
      .send({ accountId: 23 });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
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

    expect(response.body.message).toBe(`Verification emails limit of ${EMAILS_SENT_LIMIT} reached.`);
    expect(response.body.reason).toBe('emailLimitReached');
  });

  it('should accept the request, increment the count of emails sent in the table, return the updated count, and send a new verification email', async () => {
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
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/verification/verify')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
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

    expect(response.body.message).toBe('You must sign out before proceeding.');
    expect(response.body.reason).toBe('signedIn');
  });

  it('should reject requests if the account is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/verification/verify')
      .send({ accountId: 23, verificationCode: 'ASDFGH' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
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
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signIn')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
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
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/recovery/start')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
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

    expect(response.body.message).toBe('You must sign out before proceeding.');
    expect(response.body.reason).toBe('signedIn');
  });

  it('should reject requests if the account is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/recovery/start')
      .send({ email: 'example@example.com' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
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

    expect(response.body.message).toBe(`Recovery suspended.`);
    expect(response.body.reason).toBe('recoverySuspended');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
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

    expect(response.body.message).toBe(`Ongoing recovery request found.`);
    expect(response.body.reason).toBe('ongoingRequest');

    expect(response.body).toHaveProperty('resData');

    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(response.body.resData).toHaveProperty('accountId');

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
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/recovery/resendEmail')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
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

    expect(response.body.message).toBe(`Recovery suspended.`);
    expect(response.body.reason).toBe('recoverySuspended');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
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
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/recovery/updatePassword')
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
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

    expect(response.body.message).toBe(`You can't recover an account while signed in.`);
    expect(response.body.reason).toBe('signedIn');
  });

  it('should reject requests if the recovery request is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/recovery/updatePassword')
      .send({ accountId: 23, recoveryCode: 'AAAAAA', newPassword: 'someNewPassword' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
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

    expect(response.body.message).toBe('Recovery suspended.');
    expect(response.body.reason).toBe('recoverySuspended');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
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

    expect(response.body.message).toBe('Incorrect recovery code.');
    expect(response.body.reason).toBe('recoverySuspended');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
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

    expect(response.body.message).toBe('Request was suspended due to too many failed attempts.');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
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

    expect(response.body.message).toBe('Ongoing email update request found.');
    expect(response.body.reason).toBe('ongoingRequest');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
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
    expect(response.body.message).toBe('Request is suspended due to too many failed attempts.');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
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
    expect(response.body.message).toBe(`Confirmation emails limit of ${EMAILS_SENT_LIMIT} reached.`);
  });

  it('should accept the request, increment the count of emails sent in the table, then send another email update email', async () => {
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

describe('PATCH accounts/details/updateEmail/confirm', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateEmail/confirm')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateEmail/confirm')
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
      .patch('/api/accounts/details/updateEmail/confirm')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/details/updateEmail/confirm')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ confirmationCode: 'AAAAAA', someRandomValue: 23 });
    await testKeys({ someRandomValue: 23 });
  });

  it('should reject requests with an invalid confirmation code', async () => {
    async function testConfirmationCode(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .patch('/api/accounts/details/updateEmail/confirm')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid confirmation code.');
      expect(response.body.reason).toBe('confirmationCode');
    };

    await testConfirmationCode({ confirmationCode: 'AAA' });
    await testConfirmationCode({ confirmationCode: 'AAAAAAAAAAAA' });
    await testConfirmationCode({ confirmationCode: 23 });
    await testConfirmationCode({ confirmationCode: null });
    await testConfirmationCode({ confirmationCode: NaN });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateEmail/confirm')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ confirmationCode: 'AAAAAA' });

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
      .patch('/api/accounts/details/updateEmail/confirm')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ confirmationCode: 'AAAAAA' });

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
      .patch('/api/accounts/details/updateEmail/confirm')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ confirmationCode: 'AAAAAA' });

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
      .patch('/api/accounts/details/updateEmail/confirm')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ confirmationCode: 'AAAAAA' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
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
      [1, 1, 'example2@example.com', 'AAAAAA', Date.now() + dayMilliseconds, 1, FAILED_ACCOUNT_UPDATE_LIMIT]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateEmail/confirm')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ confirmationCode: 'AAAAAA' });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Email update request suspended.');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
  });

  it('should reject requests if the confirmation code is incorrect and increment the count of failed update attempts', async () => {
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
      [1, 1, 'example2@example.com', 'AAAAAA', Date.now() + dayMilliseconds, 1, 0]
    );

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateEmail/confirm')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ confirmationCode: 'BBBBBB' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Incorrect confirmation code.');
    expect(response.body.reason).toBe('incorrectCode');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toBeNull();

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT failed_update_attempts FROM email_update WHERE update_id = ?;`,
      [1]
    );

    expect(updatedRows[0].failed_update_attempts).toBe(1);
  });

  it(`should reject requests if the confirmation code is incorrect, increment the count of failed update attempts, and if the limit has been reached, suspend the request, reset the expiry timestamp, remove the user's authSessionId cookie, purge all their auth sessions, and send a warning email`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const initialRequestExpiryTimestamp: number = Date.now() + dayMilliseconds;

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 1, 'example2@example.com', 'AAAAAA', initialRequestExpiryTimestamp, 1, FAILED_ACCOUNT_UPDATE_LIMIT - 1]
    );

    const sendEmailUpdateWarningEmailSpy = jest.spyOn(emailServices, 'sendEmailUpdateWarningEmail');

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateEmail/confirm')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ confirmationCode: 'BBBBBB' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Incorrect confirmation code.');
    expect(response.body.reason).toBe('requestSuspended');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);

    expect(purgeAuthSessionsSpy).toHaveBeenCalled();
    expect(removeRequestCookieSpy).toHaveBeenCalled();
    expect(sendEmailUpdateWarningEmailSpy).toHaveBeenCalled();

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT failed_update_attempts, expiry_timestamp FROM email_update WHERE update_id = ?;`,
      [1]
    );

    expect(updatedRows[0].failed_update_attempts).toBe(FAILED_ACCOUNT_UPDATE_LIMIT);
    expect(updatedRows[0].expiry_timestamp).toBeGreaterThan(initialRequestExpiryTimestamp);
  });

  it(`should accept the request, update the user's email, delete the email_update row from the table, purge all the user's auth sessions, create a new one, return a boolean to confirm if it was created, and also return the new email`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'old@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const initialRequestExpiryTimestamp: number = Date.now() + dayMilliseconds;

    await dbPool.execute(
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 1, 'new@example.com', 'AAAAAA', initialRequestExpiryTimestamp, 1, FAILED_ACCOUNT_UPDATE_LIMIT - 1]
    );

    const createAuthSessionSpy = jest.spyOn(authSessionModule, 'createAuthSession');

    const response: SuperTestResponse = await request(app)
      .patch('/api/accounts/details/updateEmail/confirm')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ confirmationCode: 'AAAAAA' });

    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty('authSessionCreated');
    expect(typeof response.body.authSessionCreated).toBe('boolean');

    expect(response.body).toHaveProperty('newEmail');
    expect(response.body.newEmail).toBe('new@example.com');

    expect(purgeAuthSessionsSpy).toHaveBeenCalled();
    expect(createAuthSessionSpy).toHaveBeenCalled();

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT email FROM accounts WHERE account_id = ?;`,
      [1]
    );

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM email_update WHERE update_id = ?;`,
      [1]
    );

    expect(updatedRows[0].email).toBe('new@example.com');
    expect(deletedRows.length).toBe(0);
  });
});

describe('DELETE accounts/details/updateEmail/abort', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/details/updateEmail/abort')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/details/updateEmail/abort')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/details/updateEmail/abort')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/details/updateEmail/abort')
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
      .delete('/api/accounts/details/updateEmail/abort')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Email update request not found or may have expired.');
  });

  it(`should accept the request and delete the email update request`, async () => {
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
      [1, 1, 'new@example.com', 'AAAAAA', Date.now() + dayMilliseconds, 1, 0]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/details/updateEmail/abort')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM email_update WHERE update_id = ?;`,
      [1]
    );

    expect(deletedRows.length).toBe(0);
  });
});

describe('DELETE accounts/deletion/start', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/start')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/start')
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
      .delete('/api/accounts/deletion/start')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');

    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete('/api/accounts/deletion/start')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ someRandomValue: 23 });
    await testKeys({ password: 'somePassword', someRandomValue: 23 });
  });

  it('should reject requests with an invalid password', async () => {
    async function testPassword(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete('/api/accounts/deletion/start')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid password.');
    };

    await testPassword({ password: 23 });
    await testPassword({ password: '' });
    await testPassword({ password: 'white space' });
    await testPassword({ password: 'passwordIsLongerThanTwentyFourCharactersTotal' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword' });

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
      .delete('/api/accounts/deletion/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword' });

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
      .delete('/api/accounts/deletion/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword' });

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
      .delete('/api/accounts/deletion/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'incorrectPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

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
      .delete('/api/accounts/deletion/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'incorrectPassword' });

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

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

  it(`should reject requests if an ongoing deletion request is found, returning the request's expiry timestamp`, async () => {
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
      `INSERT INTO account_deletion VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + dayMilliseconds, 1, 0]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Ongoing deletion request found.');
    expect(response.body.reason).toBe('requestDetected');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
  });

  it(`should reject requests if an ongoing deletion request is found, but too many failed attempts have been made, returning the request's expiry timestamp`, async () => {
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
      `INSERT INTO account_deletion VALUES(${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + dayMilliseconds, 1, FAILED_ACCOUNT_UPDATE_LIMIT]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword' });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Deletion request suspended.');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
  });

  it(`should reject requests if an ongoing email update request is found`, async () => {
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
      `INSERT INTO email_update VALUES (${generatePlaceHolders(7)});`,
      [1, 1, 'new@example.com', 'AAAAAA', Date.now() + dayMilliseconds, 1, 0]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Ongoing email update request found.');
    expect(response.body.reason).toBe('ongoingEmailUpdate');
  });

  it(`should accept the request, insert a row in the account_deletion table, and send a deletion confirmation email`, async () => {
    const hashedPassword: string = await bcrypt.hash('somePassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, FAILED_SIGN_IN_LIMIT - 1]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const sendDeletionConfirmationEmailSpy = jest.spyOn(emailServices, 'sendDeletionConfirmationEmail');

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/start')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ password: 'somePassword' });

    expect(response.status).toBe(200);
    expect(sendDeletionConfirmationEmailSpy).toHaveBeenCalled();

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM account_deletion WHERE account_id = ?;`,
      [1]
    );

    expect(createdRows.length).toBe(1);
  });
});

describe('GET accounts/deletion/resendEmail', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/deletion/resendEmail')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/deletion/resendEmail')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/deletion/resendEmail')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/deletion/resendEmail')
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
      .get('/api/accounts/deletion/resendEmail')
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

  it('should reject requests if the deletion request is not found', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/deletion/resendEmail')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Deletion request not found.');
  });

  it(`should reject requests if the deletion request is found, but too many failed attempts have been made, returning the request's expiry timestamp`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO account_deletion VALUES (${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + dayMilliseconds, 1, FAILED_ACCOUNT_UPDATE_LIMIT]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/deletion/resendEmail')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Deletion request suspended.');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
  });

  it(`should reject requests if the deletion request is found, but the emails sent limit has been reached`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO account_deletion VALUES (${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + dayMilliseconds, EMAILS_SENT_LIMIT, 0]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/deletion/resendEmail')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe(`Confirmation emails limit of ${EMAILS_SENT_LIMIT} reached.`);
  });

  it(`should accept the request, increment the count of sent account deletion emails, and send another deletion confirmation email`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO account_deletion VALUES (${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + dayMilliseconds, 1, 0]
    );

    const sendDeletionConfirmationEmailSpy = jest.spyOn(emailServices, 'sendDeletionConfirmationEmail');

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/deletion/resendEmail')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);
    expect(sendDeletionConfirmationEmailSpy).toHaveBeenCalled();

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT deletion_emails_sent FROM account_deletion WHERE account_id = ?;`,
      [1]
    );

    expect(updatedRows[0].deletion_emails_sent).toBe(2);
  });
});

describe('DELETE accounts/deletion/confirm', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/confirm')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/confirm')
      .set('Cookie', `authSessionId=invalidId`)
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without a confirmation code in the URL query string', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/confirm')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with an invalid confirmation code', async () => {
    async function testConfirmationCode(confirmationCode: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/accounts/deletion/confirm?confirmationCode=${confirmationCode}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('reason');

      expect(response.body.message).toBe('Invalid confirmation code.');
      expect(response.body.reason).toBe('invalidConfirmationCode');
    };

    await testConfirmationCode('AA');
    await testConfirmationCode('AAAAAAAAA');
    await testConfirmationCode('in_valid');
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/confirm?confirmationCode=AAAAAA')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/confirm?confirmationCode=AAAAAA')
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
      .delete('/api/accounts/deletion/confirm?confirmationCode=AAAAAA')
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

  it('should reject requests if the account deletion request is not found', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/confirm?confirmationCode=AAAAAA')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Deletion request not found.');
  });

  it(`should reject requests if the account deletion request is found, but too many failed attempts have been made, returning the request's expiry timestamp`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO account_deletion VALUES (${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + dayMilliseconds, 1, FAILED_ACCOUNT_UPDATE_LIMIT]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/confirm?confirmationCode=AAAAAA')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Deletion request suspended.');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);
  });

  it(`should reject requests if the confirmation code is incorrect and increment the count of failed deletion attempts`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
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
      .delete('/api/accounts/deletion/confirm?confirmationCode=BBBBBB')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Incorrect confirmation code.');
    expect(response.body.reason).toBe('incorrectCode');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toBeNull();

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT failed_deletion_attempts FROM account_deletion WHERE deletion_id = ?;`,
      [1]
    );

    expect(updatedRows[0].failed_deletion_attempts).toBe(1);
  });

  it(`should reject requests if the confirmation code is incorrect, increment the count of failed deletion attempts, and if too many failed attempts have been made, suspend the request, and send a warning email`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO account_deletion VALUES (${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + dayMilliseconds, 1, FAILED_ACCOUNT_UPDATE_LIMIT - 1]
    );

    const sendDeletionWarningEmailSpy = jest.spyOn(emailServices, 'sendDeletionWarningEmail');

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/confirm?confirmationCode=BBBBBB')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Incorrect confirmation code.');
    expect(response.body.reason).toBe('requestSuspended');

    expect(response.body).toHaveProperty('resData');
    expect(response.body.resData).toHaveProperty('expiryTimestamp');
    expect(Number.isInteger(response.body.resData.expiryTimestamp)).toBe(true);

    expect(sendDeletionWarningEmailSpy).toHaveBeenCalled();

    const [updatedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT failed_deletion_attempts FROM account_deletion WHERE deletion_id = ?;`,
      [1]
    );

    expect(updatedRows[0].failed_deletion_attempts).toBe(FAILED_ACCOUNT_UPDATE_LIMIT);
  });

  it(`should accept the request, delete the account row in the table, and purge the user's auth sessions`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO account_deletion VALUES (${generatePlaceHolders(6)});`,
      [1, 1, 'AAAAAA', Date.now() + dayMilliseconds, 1, FAILED_ACCOUNT_UPDATE_LIMIT - 1]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/confirm?confirmationCode=AAAAAA')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);
    expect(purgeAuthSessionsSpy).toHaveBeenCalled();

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM accounts WHERE account_id = ?;`,
      [1]
    );

    expect(deletedRows.length).toBe(0);
  });
});

describe('DELETE accounts/deletion/abort', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/abort')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/abort')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/abort')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/abort')
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

  it('should reject requests if the account deletion request is not found', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/deletion/abort')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Account deletion request not found or may have expired.');
  });

  it('should accept the request and delete the account deletion request row from the table', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
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
      .delete('/api/accounts/deletion/abort')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM account_deletion WHERE deletion_id = ?;`,
      [1]
    );

    expect(deletedRows.length).toBe(0);
  });
});

describe('POST accounts/friends/requests/send', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/send')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/send')
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
      .post('/api/accounts/friends/requests/send')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/friends/requests/send')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ requesteeUsername: 'someUsername', someRandomValue: 23 });
    await testKeys({ someRandomValue: 23 });
  });

  it('should reject requests with an invalid requestee username', async () => {
    async function testRequesteeUsername(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/friends/requests/send')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid username.');
    };

    await testRequesteeUsername({ requesteeUsername: null });
    await testRequesteeUsername({ requesteeUsername: NaN });
    await testRequesteeUsername({ requesteeUsername: 23 });
    await testRequesteeUsername({ requesteeUsername: '' });
    await testRequesteeUsername({ requesteeUsername: 'mark' });
    await testRequesteeUsername({ requesteeUsername: 'beyondTwentyFiveCharacters' });
    await testRequesteeUsername({ requesteeUsername: '!nv@l!d-' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/send')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ requesteeUsername: 'someUsername' });

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
      .post('/api/accounts/friends/requests/send')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ requesteeUsername: 'someUsername' });

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

  it('should reject requests if the requestee account is not found', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/send')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ requesteeUsername: 'someUsername' });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('No users found with this username.');
  });

  it('should reject requests if the user attempts to send a friend request to themselves', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/send')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ requesteeUsername: 'johnDoe' });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe(`You can't send a friend request to yourself.`);
  });

  it('should reject requests if the user and requestee are already friends', async () => {
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
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/send')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ requesteeUsername: 'saraSmith' });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe(`You're already friends with this user.`);
  });

  it('should reject requests if a friend request has already been send to the requestee', async () => {
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
      `INSERT INTO friend_requests VALUES (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now()]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/send')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ requesteeUsername: 'saraSmith' });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Friend request already sent.');
    expect(response.body.reason).toBe('alreadySent');
  });

  it('should accept the request and insert a row in the friend_requests table', async () => {
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

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/send')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ requesteeUsername: 'saraSmith' });

    expect(response.status).toBe(200);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM friend_requests WHERE requester_id = ? AND requestee_id = ?;`,
      [1, 2]
    );

    expect(createdRows.length).toBe(1);
  });
});

describe('POST accounts/friends/requests/accept', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/accept')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/accept')
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
      .post('/api/accounts/friends/requests/accept')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/friends/requests/accept')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ friendRequestId: 1, someRandomValue: 23 });
    await testKeys({ someRandomValue: 23 });
  });

  it('should reject requests with an invalid friend request ID', async () => {
    async function testFriendRequestId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/friends/requests/accept')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid friend request ID.');
    };

    await testFriendRequestId({ friendRequestId: null });
    await testFriendRequestId({ friendRequestId: NaN });
    await testFriendRequestId({ friendRequestId: '' });
    await testFriendRequestId({ friendRequestId: '23' });
    await testFriendRequestId({ friendRequestId: 'white space' });
    await testFriendRequestId({ friendRequestId: '!nv@l!d' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/accept')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendRequestId: 1 });

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
      .post('/api/accounts/friends/requests/accept')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendRequestId: 1 });

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

  it(`should reject requests if the friend request is not found`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/accept')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendRequestId: 1 });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Friend request not found.');
  });

  it(`should reject requests if the two users are already friends`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [2, 'friend@example.com', 'someHashedPassword', 'saraSmith', 'Sara Smith', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO friend_requests VALUES (${generatePlaceHolders(4)});`,
      [1, 2, 1, Date.now()]
    );

    await dbPool.execute(
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/accept')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendRequestId: 1 });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Already friends with this user.');
  });

  it(`should accept the request, insert two corresponding rows into the friendships table, delete any leftover friend request rows between the users, and return both the friendship ID and friendship timestamp`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [2, 'friend@example.com', 'someHashedPassword', 'saraSmith', 'Sara Smith', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    await dbPool.execute(
      `INSERT INTO friend_requests VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 2, 1, Date.now(), 2, 1, 2, Date.now()]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/friends/requests/accept')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendRequestId: 1 });

    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty('friendship_id');
    expect(response.body).toHaveProperty('friendship_timestamp');

    expect(Number.isInteger(response.body.friendship_id)).toBe(true);
    expect(Number.isInteger(response.body.friendship_timestamp)).toBe(true);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM friendships WHERE account_id = ? OR friend_id = ?;`,
      [1, 1]
    );

    expect(createdRows.length).toBe(2);

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM friend_requests WHERE requester_id = ? OR requestee_id = ?;`,
      [1, 1]
    );

    expect(deletedRows.length).toBe(0);
  });
});

describe('DELETE accounts/friends/requests/reject', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/requests/reject')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/requests/reject')
      .set('Cookie', `authSessionId=invalidId`)
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without a friendRequestId in the URL query string', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/requests/reject')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with an invalid friend request ID', async () => {
    async function testFriendRequestId(friendRequestId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/accounts/friends/requests/reject?friendRequestId=${friendRequestId}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid friend request ID.');
    };

    await testFriendRequestId('notANumber');
    await testFriendRequestId('white space');
    await testFriendRequestId('23.5');
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/requests/reject?friendRequestId=1')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/requests/reject?friendRequestId=1')
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

  it(`should accept the request and return a successful response, even if the friend request is not found`, async () => {
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

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/requests/reject?friendRequestId=1')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);
  });

  it(`should accept the request and delete the friend request row from the table`, async () => {
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
      `INSERT INTO friend_requests VALUES(${generatePlaceHolders(4)});`,
      [1, 2, 1, Date.now()]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/requests/reject?friendRequestId=1')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM friend_requests WHERE request_id = ?;`,
      [1]
    );

    expect(deletedRows.length).toBe(0);
  });
});

describe('DELETE accounts/friends/manage/remove', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/manage/remove')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/manage/remove')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without a friendship ID in the URL query string', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/manage/remove')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with an invalid friendship ID', async () => {
    async function testFriendshipId(friendshipId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/accounts/friends/manage/remove?friendshipId=${friendshipId}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid friendship ID.');
    };

    await testFriendshipId('23.5');
    await testFriendshipId('white space');
    await testFriendshipId('!nv@l!d');
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/manage/remove?friendshipId=1')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/manage/remove?friendshipId=1')
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

  it(`should reject requests if the friend is not found`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/manage/remove?friendshipId=1')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Friend not found.');
  });

  it(`should reject accept the request and remove the two rows from the friendships table`, async () => {
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
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/friends/manage/remove?friendshipId=1')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM friendships WHERE account_id = ? OR friend_id = ?;`,
      [1, 1]
    );

    expect(deletedRows.length).toBe(0);
  });
});

describe('GET accounts/friends', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/friends')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/friends')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without an offset in the URL query string', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/friends')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with an invalid offset', async () => {
    async function testOffset(offset: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .get(`/api/accounts/friends?offset=${offset}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testOffset('2.5');
    await testOffset('white space');
    await testOffset('!nv@l!d');
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/friends?offset=0')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/friends?offset=0')
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

  it(`should accept the request and return the user's friends and their details`, async () => {
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
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/friends?offset=0')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(1);

    const friend = response.body[0];

    expect(friend).toHaveProperty('friendship_id');
    expect(Number.isInteger(friend.friendship_id)).toBe(true);

    expect(friend).toHaveProperty('friendship_timestamp');
    expect(Number.isInteger(friend.friendship_timestamp)).toBe(true);

    expect(friend).toHaveProperty('friend_username');
    expect(typeof friend.friend_username).toBe('string');

    expect(friend).toHaveProperty('friend_display_name');
    expect(typeof friend.friend_display_name).toBe('string');
  });
});

describe('POST accounts/hangoutInvites', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/hangoutInvites')
      .send({});

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/hangoutInvites')
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
      .post('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with missing or incorrect keys', async () => {
    async function testKeys(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/hangoutInvites')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys({ hangoutId: 'someHangoutId' });
    await testKeys({ friendshipId: 1 });
    await testKeys({ friendshipId: 1, hangoutId: 'someHangoutId', someRandomValue: 23 });
  });

  it('should reject requests with an invalid hangout ID', async () => {
    async function testHangoutId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/hangoutInvites')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid hangout ID.');
    };

    await testHangoutId({ friendshipId: 1, hangoutId: null });
    await testHangoutId({ friendshipId: 1, hangoutId: NaN });
    await testHangoutId({ friendshipId: 1, hangoutId: 23 });
    await testHangoutId({ friendshipId: 1, hangoutId: '' });
    await testHangoutId({ friendshipId: 1, hangoutId: 'tooShort' });
    await testHangoutId({ friendshipId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013' });
    await testHangoutId({ friendshipId: 1, hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR' });
    await testHangoutId({ friendshipId: 1, hangoutId: '1749132719013_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });
  });

  it('should reject requests with an invalid friendship ID', async () => {
    async function testFriendshipId(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/hangoutInvites')
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send(requestData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid friendship ID.');
    };

    await testFriendshipId({ friendshipId: null, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });
    await testFriendshipId({ friendshipId: NaN, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });
    await testFriendshipId({ friendshipId: '', hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });
    await testFriendshipId({ friendshipId: 'invalid', hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });
    await testFriendshipId({ friendshipId: 23.5, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendshipId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });

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
      .post('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendshipId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });

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

  it('should reject requests if the invitee is not found', async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendshipId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });

    expect(response.status).toBe(404);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Friend not found.');
    expect(response.body.reason).toBe('friendNotFound');
  });

  it('should reject requests if the hangout is not found', async () => {
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
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendshipId: 1, hangoutId: 'htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013' });

    expect(response.status).toBe(404);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Hangout not found.');
    expect(response.body.reason).toBe('hangoutNotFound');
  });

  it('should reject requests if the user is not in the hangout', async () => {
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
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const currentTimestamp: number = Date.now();
    const tempHangoutId: string = generateHangoutId(currentTimestamp);

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      [tempHangoutId, 'Dummy Hangout', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, currentTimestamp, currentTimestamp, false]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendshipId: 1, hangoutId: tempHangoutId });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe(`You can't invite friends to a hangout you're not a member of.`);
    expect(response.body.reason).toBe('notInHangout');
  });

  it('should reject requests if an invitation has already been sent', async () => {
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
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const currentTimestamp: number = Date.now();
    const tempHangoutId: string = generateHangoutId(currentTimestamp);

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      [tempHangoutId, 'Dummy Hangout', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, currentTimestamp, currentTimestamp, false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, tempHangoutId, 'johnDoe', 'account', 1, null, 'John Doe', false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_invites VALUES (${generatePlaceHolders(5)});`,
      [1, 1, 2, tempHangoutId, currentTimestamp]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendshipId: 1, hangoutId: tempHangoutId });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Invitation already sent.');
    expect(response.body.reason).toBe('alreadySent');
  });

  it('should reject requests if the invitee is already in the hangout', async () => {
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
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const currentTimestamp: number = Date.now();
    const tempHangoutId: string = generateHangoutId(currentTimestamp);

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      [tempHangoutId, 'Dummy Hangout', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, currentTimestamp, currentTimestamp, false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [1, tempHangoutId, 'johnDoe', 'account', 1, null, 'John Doe', false, /**/ 2, tempHangoutId, 'saraSmith', 'account', 2, null, 'Sara Smith', false]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendshipId: 1, hangoutId: tempHangoutId });

    expect(response.status).toBe(409);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Friend has already joined the hangout.');
    expect(response.body.reason).toBe('alreadyInHangout');
  });

  it('should accept the request and insert a row into the hangout_invites table', async () => {
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
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const currentTimestamp: number = Date.now();
    const tempHangoutId: string = generateHangoutId(currentTimestamp);

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      [tempHangoutId, 'Dummy Hangout', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, currentTimestamp, currentTimestamp, false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, tempHangoutId, 'johnDoe', 'account', 1, null, 'John Doe', false]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send({ friendshipId: 1, hangoutId: tempHangoutId });

    expect(response.status).toBe(200);

    const [createdRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangout_invites WHERE account_id = ?;`,
      [1]
    );

    expect(createdRows.length).toBe(1);
  });
});

describe('DELETE accounts/hangoutInvites', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/hangoutInvites')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without an invite ID in the URL query string', async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid invitation ID.');
  });

  it('should reject requests with an invalid invite ID', async () => {
    async function testInviteId(inviteId: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .delete(`/api/accounts/hangoutInvites?inviteId=${inviteId}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid invitation ID.');
    };

    await testInviteId('23.5');
    await testInviteId('white space');
    await testInviteId('!nv@l!d');
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/hangoutInvites?inviteId=1')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/hangoutInvites?inviteId=1')
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

  it(`should accept the request and delete the invitation in the hangout_invites table`, async () => {
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
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const currentTimestamp: number = Date.now();
    const tempHangoutId: string = generateHangoutId(currentTimestamp);

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      [tempHangoutId, 'Dummy Hangout', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, currentTimestamp, currentTimestamp, false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, tempHangoutId, 'johnDoe', 'account', 1, null, 'John Doe', false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_invites VALUES (${generatePlaceHolders(5)});`,
      [1, 2, 1, tempHangoutId, currentTimestamp]
    );

    const response: SuperTestResponse = await request(app)
      .delete('/api/accounts/hangoutInvites?inviteId=1')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    const [deletedRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT 1 FROM hangout_invites WHERe invite_id = ?;`,
      [1]
    );

    expect(deletedRows.length).toBe(0);
  });
});

describe('GET accounts/hangoutInvites', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutInvites')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without an offset in the URL query string', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutInvites')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with an invalid offset', async () => {
    async function testKeys(offset: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .get(`/api/accounts/hangoutInvites?offset=${offset}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys('23.5');
    await testKeys('white space');
    await testKeys('!nv@l!d');
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutInvites?offset=0')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutInvites?offset=0')
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

  it(`should accept the request and return all the user's pending hangout invites`, async () => {
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
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const currentTimestamp: number = Date.now();
    const tempHangoutId: string = generateHangoutId(currentTimestamp);

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      [tempHangoutId, 'Dummy Hangout', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, currentTimestamp, currentTimestamp, false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, tempHangoutId, 'johnDoe', 'account', 1, null, 'John Doe', false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_invites VALUES (${generatePlaceHolders(5)});`,
      [1, 2, 1, tempHangoutId, currentTimestamp]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutInvites?offset=0')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    expect(Array.isArray(response.body));
    expect(response.body.length).toBe(1);

    const hangoutInvite = response.body[0];

    expect(hangoutInvite).toHaveProperty('invite_id');
    expect(Number.isInteger(hangoutInvite.invite_id)).toBe(true);

    expect(hangoutInvite).toHaveProperty('hangout_id');
    expect(hangoutInvite.hangout_id).toBe(tempHangoutId);

    expect(hangoutInvite).toHaveProperty('invite_timestamp');
    expect(Number.isInteger(hangoutInvite.invite_timestamp)).toBe(true);

    expect(hangoutInvite).toHaveProperty('display_name');
    expect(hangoutInvite.display_name).toBe('Sara Smith');

    expect(hangoutInvite).toHaveProperty('username');
    expect(hangoutInvite.username).toBe('saraSmith')

    expect(hangoutInvite).toHaveProperty('hangout_title');
    expect(hangoutInvite.hangout_title).toBe('Dummy Hangout')
  });
});

describe('GET accounts/', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts')
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

  it(`should reject requests if the account is not found`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 23, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Internal server error.');
  });

  it(`should accept the request and return the user's details`, async () => {
    // unrealistic data has been inserted for testing purposes only. Having all of these rows together at once between these two users isn't possible under normal conditions

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
      `INSERT INTO friend_requests VALUES (${generatePlaceHolders(4)});`,
      [1, 2, 1, Date.now()]
    );

    await dbPool.execute(
      `INSERT INTO friendships VALUES (${generatePlaceHolders(4)}), (${generatePlaceHolders(4)});`,
      [1, 1, 2, Date.now(), 2, 2, 1, Date.now()]
    );

    const currentTimestamp: number = Date.now();
    const tempHangoutId: string = generateHangoutId(currentTimestamp);

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      [tempHangoutId, 'Dummy Hangout', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, currentTimestamp, currentTimestamp, false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)}), (${generatePlaceHolders(8)});`,
      [1, tempHangoutId, 'saraSmith', 'account', 2, null, 'Sara Smith', false, /**/ 2, tempHangoutId, 'johnDoe', 'account', 1, null, 'John Doe', false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_invites VALUES (${generatePlaceHolders(5)});`,
      [1, 2, 1, tempHangoutId, currentTimestamp]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty('accountDetails');

    expect(response.body.accountDetails).toHaveProperty('email');
    expect(typeof response.body.accountDetails.email).toBe('string');

    expect(response.body.accountDetails).toHaveProperty('username');
    expect(typeof response.body.accountDetails.username).toBe('string');

    expect(response.body.accountDetails).toHaveProperty('display_name');
    expect(typeof response.body.accountDetails.display_name).toBe('string');

    expect(response.body.accountDetails).toHaveProperty('created_on_timestamp');
    expect(Number.isInteger(response.body.accountDetails.created_on_timestamp)).toBe(true);

    expect(response.body.accountDetails).toHaveProperty('ongoing_email_update_request');
    expect([0, 1]).toContain(response.body.accountDetails.ongoing_email_update_request);

    expect(response.body.accountDetails).toHaveProperty('ongoing_account_deletion_request');
    expect([0, 1]).toContain(response.body.accountDetails.ongoing_account_deletion_request);


    expect(response.body).toHaveProperty('friends');
    expect(Array.isArray(response.body.friends)).toBe(true);
    expect(response.body.friends.length).toBe(1);

    const friend = response.body.friends[0];

    expect(friend).toHaveProperty('friendship_id');
    expect(Number.isInteger(friend.friendship_id)).toBe(true);

    expect(friend).toHaveProperty('friendship_timestamp');
    expect(Number.isInteger(friend.friendship_timestamp)).toBe(true);

    expect(friend).toHaveProperty('friend_username');
    expect(typeof friend.friend_username).toBe('string');

    expect(friend).toHaveProperty('friend_display_name');
    expect(typeof friend.friend_display_name).toBe('string');


    expect(response.body).toHaveProperty('friendRequests');
    expect(Array.isArray(response.body.friendRequests)).toBe(true);
    expect(response.body.friendRequests.length).toBe(1);

    const friendRequest = response.body.friendRequests[0];

    expect(friendRequest).toHaveProperty('request_id');
    expect(Number.isInteger(friendRequest.request_id)).toBe(true);

    expect(friendRequest).toHaveProperty('request_timestamp');
    expect(Number.isInteger(friendRequest.request_timestamp)).toBe(true);

    expect(friendRequest).toHaveProperty('requester_username');
    expect(typeof friendRequest.requester_username).toBe('string');

    expect(friendRequest).toHaveProperty('requester_display_name');
    expect(typeof friendRequest.requester_display_name).toBe('string');


    expect(response.body).toHaveProperty('hangoutHistory');
    expect(Array.isArray(response.body.hangoutHistory)).toBe(true);
    expect(response.body.hangoutHistory.length).toBe(1);

    const hangout = response.body.hangoutHistory[0];

    expect(hangout).toHaveProperty('hangout_id');
    expect(typeof hangout.hangout_id).toBe('string');

    expect(hangout).toHaveProperty('hangout_title');
    expect(typeof hangout.hangout_title).toBe('string');

    expect(hangout).toHaveProperty('current_stage');
    expect(Number.isInteger(hangout.current_stage)).toBe(true);

    expect(hangout).toHaveProperty('is_concluded');
    expect([0, 1]).toContain(hangout.is_concluded);

    expect(hangout).toHaveProperty('created_on_timestamp');
    expect(Number.isInteger(hangout.created_on_timestamp));


    expect(response.body).toHaveProperty('hangoutInvites');
    expect(Array.isArray(response.body.hangoutInvites)).toBe(true);
    expect(response.body.hangoutInvites.length).toBe(1);

    const hangoutInvite = response.body.hangoutInvites[0];

    expect(hangoutInvite).toHaveProperty('invite_id');
    expect(Number.isInteger(hangoutInvite.invite_id));

    expect(hangoutInvite).toHaveProperty('hangout_id');
    expect(typeof hangoutInvite.hangout_id).toBe('string');

    expect(hangoutInvite).toHaveProperty('invite_timestamp');
    expect(Number.isInteger(hangoutInvite.invite_timestamp));

    expect(hangoutInvite).toHaveProperty('display_name');
    expect(typeof hangoutInvite.display_name).toBe('string');

    expect(hangoutInvite).toHaveProperty('username');
    expect(typeof hangoutInvite.username).toBe('string');

    expect(hangoutInvite).toHaveProperty('hangout_title');
    expect(typeof hangoutInvite.hangout_title).toBe('string');


    expect(response.body).toHaveProperty('hangoutsJoinedCount');
    expect(Number.isInteger(response.body.hangoutsJoinedCount)).toBe(true);

    expect(response.body).toHaveProperty('ongoingHangoutsCount');
    expect(Number.isInteger(response.body.ongoingHangoutsCount)).toBe(true);
  });
});

describe('GET accounts/hangoutHistory', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutHistory')
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');
  });

  it('should reject requests if an invalid authSessionId cookie is found, and remove it', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutHistory')
      .set('Cookie', `authSessionId=invalidId`)
      .send();

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('reason');

    expect(response.body.message).toBe('Sign in session expired.');
    expect(response.body.reason).toBe('authSessionExpired');

    expect(removeRequestCookieSpy).toHaveBeenCalled();
  });

  it('should reject requests without an offset in the URL query string', async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutHistory')
      .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Invalid request data.');
  });

  it('should reject requests with an invalid offset', async () => {
    async function testKeys(offset: string): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .get(`/api/accounts/hangoutHistory?offset=${offset}`)
        .set('Cookie', `authSessionId=${generateAuthSessionId()}`)
        .send();

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid request data.');
    };

    await testKeys('23.5');
    await testKeys('white space');
    await testKeys('!nv@l!d');
  });

  it(`should reject requests if the user's auth session is not found, and remove the authSessionId cookie`, async () => {
    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutHistory?offset=0')
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
      ['dummyAuthSessionIdForTesting1234', 1, 'guest', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutHistory?offset=0')
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

  it(`should accept the request and return an array of the user's hangout history`, async () => {
    await dbPool.execute(
      `INSERT INTO accounts VALUES (${generatePlaceHolders(8)});`,
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe', 'John Doe', Date.now(), true, 0]
    );

    await dbPool.execute(
      `INSERT INTO auth_sessions VALUES (${generatePlaceHolders(5)});`,
      ['dummyAuthSessionIdForTesting1234', 1, 'account', Date.now(), Date.now() + hourMilliseconds * 6]
    );

    const currentTimestamp: number = Date.now();
    const tempHangoutId: string = generateHangoutId(currentTimestamp);

    await dbPool.execute(
      `INSERT INTO hangouts VALUES (${generatePlaceHolders(11)});`,
      [tempHangoutId, 'Dummy Hangout', null, 10, dayMilliseconds, dayMilliseconds, dayMilliseconds, 1, currentTimestamp, currentTimestamp, false]
    );

    await dbPool.execute(
      `INSERT INTO hangout_members VALUES (${generatePlaceHolders(8)});`,
      [1, tempHangoutId, 'johnDoe', 'account', 1, null, 'John Doe', false]
    );

    const response: SuperTestResponse = await request(app)
      .get('/api/accounts/hangoutHistory?offset=0')
      .set('Cookie', `authSessionId=dummyAuthSessionIdForTesting1234`)
      .send();

    expect(response.status).toBe(200);

    expect(Array.isArray(response.body));
    expect(response.body.length).toBe(1);

    const hangout = response.body[0];

    expect(hangout).toHaveProperty('hangout_id');
    expect(typeof hangout.hangout_id).toBe('string');

    expect(hangout).toHaveProperty('hangout_title');
    expect(typeof hangout.hangout_title).toBe('string');

    expect(hangout).toHaveProperty('current_stage');
    expect(Number.isInteger(hangout.current_stage)).toBe(true);

    expect(hangout).toHaveProperty('is_concluded');
    expect([0, 1]).toContain(hangout.is_concluded);

    expect(hangout).toHaveProperty('created_on_timestamp');
    expect(Number.isInteger(hangout.created_on_timestamp)).toBe(true);
  });
});