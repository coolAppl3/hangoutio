import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { generatePlaceHolders } from '../../src/util/generatePlaceHolders';
import { ACCOUNT_VERIFICATION_WINDOW, dayMilliseconds, EMAILS_SENT_LIMIT } from '../../src/util/constants';
import * as emailServices from '../../src/util/email/emailServices';
import { RowDataPacket } from 'mysql2';

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
  interface ValidRequestData {
    email: string,
    displayName: string,
    username: string,
    password: string,
  };

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

  it('should reject request with an invalid email address', async () => {
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

  it('should reject request with an invalid username', async () => {
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

  it('should reject request with an invalid display name', async () => {
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

  it('should reject request with an invalid password', async () => {
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

  it('should reject request with identical username and password', async () => {
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

    async function testTakenEmail(requestData: ValidRequestData): Promise<void> {
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

    async function testTakenUsername(requestData: ValidRequestData): Promise<void> {
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

    async function testTakenUsername(requestData: ValidRequestData): Promise<void> {
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

  it('should insert insert rows into the accounts and account_verification tables, return the account ID and verification expiry timestamp, and send a verification email', async () => {
    async function testValidInputs(requestData: ValidRequestData): Promise<void> {
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
  interface ValidRequestData {
    accountId: number,
  };

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

  it('should reject request with an invalid or non-integer account ID', async () => {
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

    expect(response.body.message).toBe('Verification emails limit reached.');
    expect(response.body.reason).toBe('emailLimitReached');
  });

  it('should update the count of emails sent in the table, return the updated count, and send a new verification email', async () => {
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

    const [updatedRows] = await dbPool.execute(
      `SELECT verification_emails_sent FROM account_verification WHERE verification_id = ?;`,
      [1]
    );

    expect(updatedRows[0].verification_emails_sent).toBe(2);
    expect(sendVerificationEmailMock).toHaveBeenCalled();
  });
});