import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';
import { ACCOUNT_VERIFICATION_WINDOW, dayMilliseconds, EMAILS_SENT_LIMIT, FAILED_ACCOUNT_UPDATE_LIMIT, hourMilliseconds } from '../../src/util/constants';
import * as emailServices from '../../src/util/email/emailServices';
import { RowDataPacket } from 'mysql2';
import * as authSessionModule from '../../src/auth/authSessions';
import bcrypt from 'bcrypt';

beforeEach(async () => {
  await dbPool.query(
    `DELETE FROM accounts;
    DELETE FROM account_verification;
    DELETE FROM account_recovery;
    DELETE FROM account_deletion;
    DELETE FROM email_update;
    DELETE FROM friend_requests;
    DELETE FROM friendships;
    DELETE FROM hangout_invites;
    DELETE FROM guests;
    DELETE FROM hangouts;`
  );
});

afterAll(() => {
  jest.resetAllMocks();
});

describe('POST accounts/signUp', () => {
  it('should reject requests with an empty body.', async () => {
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

  it('should reject requests with an invalid email address', async () => {
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
      [1, 'example1@example.com', 'someHashedPassword', 'johnDoe', Date.now(), 'John Doe', true, 0]
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
      [1, 'example@example.com', 'someHashedPassword', 'johnDoe1', Date.now(), 'John Doe', true, 0]
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
      [1, 'example1@example.com', 'someHashedPassword', 'johnDoe1', Date.now(), 'John Doe', true, 0]
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

    async function testTakenUsername(requestData: any): Promise<void> {
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

    await testTakenUsername({ email: 'example1@example.com', username: 'johnDoe1', displayName: 'John Doe', password: 'somePassword' });
    await testTakenUsername({ email: 'example2@example.com', username: 'JohnDoe1', displayName: 'John Doe', password: 'somePassword' });
    await testTakenUsername({ email: 'example2@example.com', username: 'JohnDoe2', displayName: 'John Doe', password: 'somePassword' });
    await testTakenUsername({ email: 'example2@example.com', username: 'JohnDoe2', displayName: 'John Doe', password: 'somePassword' });
  });

  it('should accept the request, insert rows into the accounts and account_verification tables, return the account ID and verification expiry timestamp, and send a verification email', async () => {
    async function testValidInputs(requestData: any): Promise<void> {
      const response: SuperTestResponse = await request(app)
        .post('/api/accounts/signUp')
        .send(requestData);

      expect(response.status).toBe(201);

      expect(response.body).toHaveProperty('accountId');
      expect(response.body).toHaveProperty('verificationExpiryTimestamp');

      expect(typeof response.body.accountId).toBe('number');
      expect(typeof response.body.verificationExpiryTimestamp).toBe('number');

      expect(Number.isInteger(response.body.accountId)).toBe(true);
      expect(Number.isInteger(response.body.verificationExpiryTimestamp)).toBe(true);
    };

    const sendVerificationEmailMock = jest.spyOn(emailServices, 'sendVerificationEmail');

    await testValidInputs({ email: 'example1@example.com', username: 'johnDoe1', displayName: 'John Doe', password: 'somePassword' });
    await testValidInputs({ email: 'example2@example.com', username: 'johnDoe2', displayName: 'John Doe', password: 'somePassword' });

    const [accountRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT account_id FROM accounts WHERE username = ? OR username = ?;`,
      ['johnDoe1', 'johnDoe2']
    );

    const [accountVerificationRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS row_count FROM account_verification WHERE account_id = ? OR account_id = ?;`,
      [accountRows[0].account_id, accountRows[1].account_id]
    );

    expect(accountRows.length).toBe(2);
    expect(accountVerificationRows[0].row_count).toBe(2);

    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(2);
  });
});

describe('POST accounts/verification/resendEmail', () => {
  it('should reject requests with an empty body.', async () => {
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

  it('should reject requests with an invalid or non-integer account ID', async () => {
    async function testEmail(requestData: any): Promise<void> {
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

    await testEmail({ accountId: 23.5 });
    await testEmail({ accountId: 'someString' });
    await testEmail({ accountId: NaN });
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

  it('should reject requests with a non-existent account ID', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/verification/resendEmail')
      .send({ accountId: 23 });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message).toBe('string');
    expect(response.body.message).toBe('Account not found.');
  });

  it('should reject requests for accounts that are already verified', async () => {
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

  it('should reject requests if no verification request is found', async () => {
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

    const sendVerificationEmailMock = jest.spyOn(emailServices, 'sendVerificationEmail');

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
    expect(sendVerificationEmailMock).toHaveBeenCalled();
  });
});

describe('PATCH accounts/verification/verify', () => {
  it('should reject requests with an empty body.', async () => {
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
    async function testAccountId(requestData: any): Promise<void> {
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

    await testAccountId({ accountId: 23, verificationCode: null });
    await testAccountId({ accountId: 23, verificationCode: NaN });
    await testAccountId({ accountId: 23, verificationCode: '' });
    await testAccountId({ accountId: 23, verificationCode: '123' });
    await testAccountId({ accountId: 23, verificationCode: 'ASD' });
    await testAccountId({ accountId: 23, verificationCode: 'ASDFGHJK' });
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

  it('should reject requests with an incorrect verification codes and update the failed verification attempts count', async () => {
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

  it('should reject requests with an incorrect verification code, and if this is the 3rd failed attempt, delete the account', async () => {
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
  it('should reject requests with an empty body.', async () => {
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

  it('should reject requests with an invalid email address', async () => {
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

  it('should reject requests with an invalid password, but not as strictly as the signup endpoint', async () => {
    async function testEmail(requestData: any): Promise<void> {
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

    await testEmail({ email: 'example@example.com', password: 23, keepSignedIn: true, });
    await testEmail({ email: 'example@example.com', password: '', keepSignedIn: true, });
    await testEmail({ email: 'example@example.com', password: 'white space', keepSignedIn: true, });
    await testEmail({ email: 'example@example.com', password: 'passwordIsLongerThanTwentyFourCharactersTotal', keepSignedIn: true, });
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

  it('should reject requests if the password is incorrect, and lock the account if a 5th failed attempt is made', async () => {
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

  it('should accept the request if the password is correct, reset the count of failed sign in attempts to 0, and create an auth session for the user', async () => {
    const createAuthSessionSpy = jest.spyOn(authSessionModule, 'createAuthSession');
    const hashedPassword: string = await bcrypt.hash('correctPassword', 10);

    await dbPool.execute(
      `INSERT INTO accounts VALUES(${generatePlaceHolders(8)});`,
      [1, 'example@example.com', hashedPassword, 'johnDoe', 'John Doe', Date.now(), true, 3]
    );

    const response: SuperTestResponse = await request(app)
      .post('/api/accounts/signIn')
      .send({ email: 'example@example.com', password: 'correctPassword', keepSignedIn: true, });

    expect(response.status).toBe(200);
    expect(createAuthSessionSpy).toHaveBeenCalled();

    const [updateRows] = await dbPool.execute<RowDataPacket[]>('SELECT failed_sign_in_attempts FROM accounts WHERE account_id = ?;', [1]);
    expect(updateRows[0].failed_sign_in_attempts).toBe(0);
  });
});

describe('POST accounts/recovery/start', () => {
  it('should reject requests with an empty body.', async () => {
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

  it('should reject requests with an invalid email address', async () => {
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

  it('should reject requests if an existing recovery request is found, but too many failed attempts have been made, returning the account recovery request expiry timestamp', async () => {
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

  it(`should reject requests if an existing recovery request is found, and if the user hasn't had too many failed attempts, return the account recovery timestamp alongside the account ID`, async () => {
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

  it('should accept the request if no ongoing account recovery requests or suspensions are ongoing, insert a row into the account_recovery table, return both the account ID and request expiry timestamp, and send a recovery email', async () => {
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
  it('should reject requests with an empty body.', async () => {
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

  it('should reject requests if an existing recovery request is found, but too many failed attempts have been made, returning the account recovery request expiry timestamp', async () => {
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

    const [updatedRows] = await dbPool.execute(`SELECT recovery_emails_sent FROM account_recovery WHERE account_id = ?;`, [1]);
    expect(updatedRows[0].recovery_emails_sent).toBe(2);
  });
});