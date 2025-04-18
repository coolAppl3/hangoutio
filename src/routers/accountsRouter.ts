import express, { Router, Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { dbPool } from '../db/db';
import bcrypt from 'bcrypt';
import * as userValidation from '../util/validation/userValidation';
import { generateRandomCode } from '../util/tokenGenerator';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { sendDeletionConfirmationEmail, sendDeletionWarningEmail, sendEmailUpdateEmail, sendEmailUpdateWarningEmail, sendRecoveryEmail, sendVerificationEmail } from '../util/email/emailServices';
import { generatePlaceHolders } from '../util/generatePlaceHolders';
import { isSqlError } from '../util/isSqlError';
import { createAuthSession, destroyAuthSession, purgeAuthSessions } from '../auth/authSessions';
import { removeRequestCookie, getRequestCookie } from '../util/cookieUtils';
import * as authUtils from '../auth/authUtils';
import { handleIncorrectAccountPassword } from '../util/accountServices';
import { ACCOUNT_DELETION_SUSPENSION_WINDOW, ACCOUNT_DELETION_WINDOW, ACCOUNT_EMAIL_UPDATE_WINDOW, ACCOUNT_RECOVERY_WINDOW, ACCOUNT_VERIFICATION_WINDOW, EMAILS_SENT_LIMIT, FAILED_ACCOUNT_UPDATE_LIMIT, FAILED_SIGN_IN_LIMIT } from '../util/constants';
import { sendHangoutWebSocketMessage } from '../webSockets/hangout/hangoutWebSocketServer';

export const accountsRouter: Router = express.Router();

accountsRouter.post('/signUp', async (req: Request, res: Response) => {
  interface RequestData {
    email: string,
    displayName: string,
    username: string,
    password: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['email', 'username', 'displayName', 'password'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmail(requestData.email)) {
    res.status(400).json({ message: 'Invalid email address.', reason: 'invalidEmail' });
    return;
  };

  if (!userValidation.isValidDisplayName(requestData.displayName)) {
    res.status(400).json({ message: 'Invalid display name.', reason: 'invalidDisplayName' });
    return;
  };

  if (!userValidation.isValidUsername(requestData.username)) {
    res.status(400).json({ message: 'Invalid username.', reason: 'invalidUsername' });
    return;
  };

  if (!userValidation.isValidNewPassword(requestData.password)) {
    res.status(400).json({ message: 'Invalid password.', reason: 'invalidPassword' });
    return;
  };

  if (requestData.username === requestData.password) {
    res.status(409).json({ message: `Password can't be identical to username.`, reason: 'passwordEqualsUsername' });
    return;
  };

  const existingAuthSessionId: string | null = getRequestCookie(req, 'authSessionId');
  if (existingAuthSessionId) {
    res.status(403).json({ message: 'You must sign out before proceeding.', reason: 'signedIn' });
    return;
  };

  let connection;

  try {
    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    const [emailUsernameRows] = await connection.execute<RowDataPacket[]>(
      `(SELECT 1 AS taken_status FROM accounts WHERE email = :email LIMIT 1)
      UNION ALL
      (SELECT 1 AS taken_status FROM email_update WHERE new_email = :email LIMIT 1)
      UNION ALL
      (SELECT 2 AS taken_status FROM accounts WHERE username = :username LIMIT 1)
      UNION ALL
      (SELECT 2 AS taken_status FROM guests WHERE username = :username LIMIT 1);`,
      { email: requestData.email, username: requestData.username }
    );

    if (emailUsernameRows.length > 0) {
      await connection.rollback();

      const takenDataSet: Set<number> = new Set();
      emailUsernameRows.forEach((row) => takenDataSet.add(row.taken_status));

      if (takenDataSet.has(1) && takenDataSet.has(2)) {
        res.status(409).json({
          message: 'Email address and username are both already taken.',
          reason: 'emailAndUsernameTaken',
        });

        return;
      };

      if (takenDataSet.has(1)) {
        res.status(409).json({ message: 'Email address is already taken.', reason: 'emailTaken' });
        return;
      };

      if (takenDataSet.has(2)) {
        res.status(409).json({ message: 'Username is already taken.', reason: 'usernameTaken' });
        return;
      };

      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    const verificationCode: string = generateRandomCode();
    const hashedPassword: string = await bcrypt.hash(requestData.password, 10);
    const createdOnTimestamp: number = Date.now();

    const verificationExpiryTimestamp: number = createdOnTimestamp + ACCOUNT_VERIFICATION_WINDOW;

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO accounts (
        email,
        hashed_password,
        username,
        display_name,
        created_on_timestamp,
        is_verified,
        failed_sign_in_attempts
      ) VALUES (${generatePlaceHolders(7)});`,
      [requestData.email, hashedPassword, requestData.username, requestData.displayName, createdOnTimestamp, false, 0]
    );

    const accountId: number = resultSetHeader.insertId;

    await connection.execute(
      `INSERT INTO account_verification (
        account_id,
        verification_code,
        verification_emails_sent,
        failed_verification_attempts,
        expiry_timestamp
      ) VALUES (${generatePlaceHolders(5)});`,
      [accountId, verificationCode, 1, 0, verificationExpiryTimestamp]
    );

    await connection.commit();
    res.status(201).json({ accountId, verificationExpiryTimestamp });

    await sendVerificationEmail({
      to: requestData.email,
      accountId,
      verificationCode,
      displayName: requestData.displayName,
      expiryTimestamp: verificationExpiryTimestamp,
    });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (!isSqlError(err)) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    const sqlError: SqlError = err;

    if (sqlError.errno === 1062 && sqlError.sqlMessage?.endsWith(`for key 'email'`)) {
      res.status(409).json({ message: 'Email address is already taken.', reason: 'emailTaken' });
      return;
    };

    if (sqlError.errno === 1062 && sqlError.sqlMessage?.endsWith(`for key 'username'`)) {
      res.status(409).json({ message: 'Username is already taken.', reason: 'usernameTaken' });
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

accountsRouter.post('/verification/resendEmail', async (req: Request, res: Response) => {
  interface RequestData {
    accountId: number,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['accountId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountId)) {
    res.status(400).json({ message: 'Invalid account ID.', reason: 'invalidAccountId' });
    return;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      email: string,
      display_name: string,
      is_verified: boolean,
      verification_id: number,
      verification_code: string,
      verification_emails_sent: number,
      expiry_timestamp: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.email,
        accounts.display_name,
        accounts.is_verified,
        account_verification.verification_id,
        account_verification.verification_code,
        account_verification.verification_emails_sent,
        account_verification.expiry_timestamp
      FROM
        accounts
      LEFT JOIN
        account_verification ON accounts.account_id = account_verification.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`,
      [requestData.accountId]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    };

    if (accountDetails.is_verified) {
      res.status(409).json({ message: 'Account already verified.', reason: 'alreadyVerified' });
      return;
    };

    if (!accountDetails.verification_id) {
      res.status(404).json({ message: 'Verification request not found.' });
      return;
    };

    if (accountDetails.verification_emails_sent >= EMAILS_SENT_LIMIT) {
      res.status(403).json({ message: 'Verification emails limit reached.', reason: 'emailLimitReached' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        account_verification
      SET
        verification_emails_sent = verification_emails_sent + 1
      WHERE
        verification_id = ?;`,
      [accountDetails.verification_id]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    res.json({ verificationEmailsSent: accountDetails.verification_emails_sent });

    await sendVerificationEmail({
      to: accountDetails.email,
      accountId: requestData.accountId,
      verificationCode: accountDetails.verification_code,
      displayName: accountDetails.display_name,
      expiryTimestamp: accountDetails.expiry_timestamp,
    });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.patch('/verification/verify', async (req: Request, res: Response) => {
  interface RequestData {
    accountId: number,
    verificationCode: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['accountId', 'verificationCode'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountId)) {
    res.status(400).json({ message: 'Invalid account ID.', reason: 'invalidAccountId' });
    return;
  };

  if (!userValidation.isValidRandomCode(requestData.verificationCode)) {
    res.status(400).json({ message: 'Invalid verification code.', reason: 'verificationCode' });
    return;
  };

  const existingAuthSessionId: string | null = getRequestCookie(req, 'authSessionId');
  if (existingAuthSessionId) {
    res.status(403).json({ message: 'You must sign out before proceeding.', reason: 'signedIn' });
    return;
  };

  let connection;

  try {
    interface AccountDetails extends RowDataPacket {
      is_verified: boolean,
      verification_id: number,
      verification_code: string,
      failed_verification_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.is_verified,
        account_verification.verification_id,
        account_verification.verification_code,
        account_verification.failed_verification_attempts
      FROM
        accounts
      LEFT JOIN
        account_verification ON accounts.account_id = account_verification.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`,
      [requestData.accountId]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    };

    if (accountDetails.is_verified) {
      res.status(409).json({ message: 'Account already verified.' });
      return;
    };

    const isCorrectVerificationCode: boolean = requestData.verificationCode === accountDetails.verification_code;
    if (!isCorrectVerificationCode) {
      if (accountDetails.failed_verification_attempts + 1 >= FAILED_ACCOUNT_UPDATE_LIMIT) {
        await dbPool.execute(
          `DELETE FROM
            accounts
          WHERE
            account_id = ?;`,
          [requestData.accountId]
        );

        res.status(401).json({ message: 'Incorrect verification code.', reason: 'accountDeleted' });
        return;
      };

      await dbPool.execute(
        `UPDATE
          account_verification
        SET
          failed_verification_attempts = failed_verification_attempts + 1
        WHERE
          verification_id = ?;`,
        [accountDetails.verification_id]
      );

      res.status(401).json({ message: 'Incorrect verification code.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const [firstResultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        is_verified = ?
      WHERE
        account_id = ?;`,
      [true, requestData.accountId]
    );

    if (firstResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ message: 'Internal server error.' });

      return;
    };

    const [secondResultSetHeader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        account_verification
      WHERE
        verification_id = ?;`,
      [accountDetails.verification_id]
    );

    if (secondResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ message: 'Internal server error.' });

      return;
    };

    await connection.commit();

    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: requestData.accountId,
      user_type: 'account',
      keepSignedIn: false,
    });

    res.json({ authSessionCreated });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

accountsRouter.post('/signIn', async (req: Request, res: Response) => {
  interface RequestData {
    email: string,
    password: string,
    keepSignedIn: boolean,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['email', 'password', 'keepSignedIn'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmail(requestData.email)) {
    res.status(400).json({ message: 'Invalid email address.', reason: 'invalidEmail' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(400).json({ message: 'Invalid account password.', reason: 'invalidPassword' });
    return;
  };

  if (typeof requestData.keepSignedIn !== 'boolean') {
    requestData.keepSignedIn = false;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      account_id: number,
      hashed_password: string,
      is_verified: boolean,
      failed_sign_in_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        account_id,
        hashed_password,
        is_verified,
        failed_sign_in_attempts
      FROM
        accounts
      WHERE
        email = ?
      LIMIT 1;`,
      [requestData.email]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    };

    if (accountDetails.failed_sign_in_attempts >= FAILED_SIGN_IN_LIMIT) {
      res.status(403).json({ message: 'Account locked.', reason: 'accountLocked' });
      return;
    };

    if (!accountDetails.is_verified) {
      res.status(403).json({ message: 'Account unverified.', reason: 'unverified' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, accountDetails.account_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    if (accountDetails.failed_sign_in_attempts > 0) {
      await dbPool.execute(
        `UPDATE
          accounts
        SET
          failed_sign_in_attempts = 0
        WHERE
          account_id = ?;`,
        [accountDetails.account_id]
      );
    };

    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: accountDetails.account_id,
      user_type: 'account',
      keepSignedIn: requestData.keepSignedIn,
    });

    if (!authSessionCreated) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    res.json({});

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.post('/recovery/start', async (req: Request, res: Response) => {
  interface RequestData {
    email: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['email'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmail(requestData.email)) {
    res.status(400).json({ message: 'Invalid email address.', reason: 'invalidEmail' });
    return;
  };

  const existingAuthSessionId: string | null = getRequestCookie(req, 'authSessionId');
  if (existingAuthSessionId) {
    res.status(403).json({ message: 'You must sign out before proceeding.', reason: 'signedIn' });
    return;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      account_id: number,
      display_name: string,
      is_verified: boolean,
      expiry_timestamp: number,
      failed_recovery_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.account_id,
        accounts.display_name,
        accounts.is_verified,
        account_recovery.expiry_timestamp,
        account_recovery.failed_recovery_attempts
      FROM
        accounts
      LEFT JOIN
        account_recovery ON accounts.account_id = account_recovery.account_id
      WHERE
        accounts.email = ?
      LIMIT 1;`,
      [requestData.email]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    };

    if (!accountDetails.is_verified) {
      res.status(403).json({ message: `Can't recover an unverified account.`, reason: 'accountUnverified' });
      return;
    };

    if (accountDetails.expiry_timestamp) {
      if (accountDetails.failed_recovery_attempts >= FAILED_ACCOUNT_UPDATE_LIMIT) {
        res.status(403).json({
          message: 'Recovery suspended.',
          reason: 'recoverySuspended',
          resData: {
            expiryTimestamp: accountDetails.expiry_timestamp,
          },
        });

        return;
      };

      res.status(409).json({
        message: 'Ongoing recovery request found.',
        reason: 'ongoingRequest',
        resData: {
          expiryTimestamp: accountDetails.expiry_timestamp,
          accountId: accountDetails.account_id,
        },
      });

      return;
    };

    const recoveryCode: string = generateRandomCode();
    const expiryTimestamp: number = Date.now() + ACCOUNT_RECOVERY_WINDOW;

    await dbPool.execute(
      `INSERT INTO account_recovery (
          account_id,
          recovery_code,
          expiry_timestamp,
          recovery_emails_sent,
          failed_recovery_attempts
        ) VALUES (${generatePlaceHolders(5)});`,
      [accountDetails.account_id, recoveryCode, expiryTimestamp, 1, 0]
    );

    res.json({ accountId: accountDetails.account_id, expiryTimestamp });

    await sendRecoveryEmail({
      to: requestData.email,
      accountId: accountDetails.account_id,
      recoveryCode: recoveryCode,
      expiryTimestamp,
      displayName: accountDetails.display_name,
    });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.post('/recovery/resendEmail', async (req: Request, res: Response) => {
  interface RequestData {
    accountId: number,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['accountId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountId)) {
    res.status(400).json({ message: 'Invalid account ID.' });
    return;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      email: string,
      display_name: string,
      recovery_code: string,
      expiry_timestamp: number,
      recovery_emails_sent: number,
      failed_recovery_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.email,
        accounts.display_name,
        account_recovery.recovery_code,
        account_recovery.expiry_timestamp,
        account_recovery.recovery_emails_sent,
        account_recovery.failed_recovery_attempts
      FROM
        accounts
      LEFT JOIN
        account_recovery ON accounts.account_id = account_recovery.account_id
      WHERE
        accounts.account_id = ?;`,
      [requestData.accountId]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      res.status(404).json({ message: 'Account not found.', reason: 'accountNotFound' });
      return;
    };

    if (!accountDetails.recovery_code) {
      res.status(404).json({ message: 'Recovery request not found or has expired.', reason: 'requestNotFound' });
      return;
    };

    if (accountDetails.failed_recovery_attempts >= FAILED_ACCOUNT_UPDATE_LIMIT) {
      res.status(403).json({
        message: 'Recovery suspended.',
        reason: 'recoverySuspended',
        resData: { expiryTimestamp: accountDetails.expiry_timestamp },
      });

      return;
    };

    if (accountDetails.recovery_emails_sent >= EMAILS_SENT_LIMIT) {
      res.status(403).json({ message: 'Recovery emails limit reached.', reason: 'limitReached' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        account_recovery
      SET
        recovery_emails_sent = recovery_emails_sent + 1
      WHERE
        account_id = ?
      LIMIT 1;`,
      [requestData.accountId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    res.json({});

    await sendRecoveryEmail({
      to: accountDetails.email,
      accountId: accountDetails.user_id,
      recoveryCode: accountDetails.recovery_code,
      expiryTimestamp: accountDetails.expiry_timestamp,
      displayName: accountDetails.display_name,
    });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.patch('/recovery/updatePassword', async (req: Request, res: Response) => {
  interface RequestData {
    accountId: number,
    recoveryCode: string,
    newPassword: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['accountId', 'recoveryCode', 'newPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountId)) {
    res.status(400).json({ message: 'Invalid account ID.' });
    return;
  };

  if (!userValidation.isValidRandomCode(requestData.recoveryCode)) {
    res.status(400).json({ message: 'Invalid recovery code.', reason: 'invalidRecoveryCode' });
    return;
  };

  if (!userValidation.isValidNewPassword(requestData.newPassword)) {
    res.status(400).json({ message: 'Invalid new password.', reason: 'invalidPassword' });
    return;
  };

  const existingAuthSessionId: string | null = getRequestCookie(req, 'authSessionId');
  if (existingAuthSessionId) {
    res.status(403).json({ message: `You can't recover an account while signed in.`, reason: 'signedIn' });
    return;
  };

  try {
    interface RecoveryDetails extends RowDataPacket {
      recovery_id: number,
      recovery_code: string,
      failed_recovery_attempts: number,
      expiry_timestamp: number,
      username: string,
    };

    const [recoveryRows] = await dbPool.execute<RecoveryDetails[]>(
      `SELECT
        recovery_id,
        recovery_code,
        failed_recovery_attempts,
        expiry_timestamp,
        (SELECT username FROM accounts WHERE account_id = :accountId) AS username
      FROM
        account_recovery
      WHERE
        account_id = :accountId
      LIMIT 1;`,
      { accountId: requestData.accountId }
    );

    const recoveryDetails: RecoveryDetails | undefined = recoveryRows[0];

    if (!recoveryDetails) {
      res.status(404).json({ message: 'Recovery request not found.' });
      return;
    };

    if (recoveryDetails.failed_recovery_attempts >= FAILED_ACCOUNT_UPDATE_LIMIT) {
      res.status(403).json({
        message: 'Recovery suspended.',
        reason: 'recoverySuspended',
        resData: {
          expiryTimestamp: recoveryDetails.expiry_timestamp,
        },
      });

      return;
    };

    if (requestData.recoveryCode !== recoveryDetails.recovery_code) {
      await dbPool.execute(
        `UPDATE
          account_recovery
        SET
          failed_recovery_attempts = failed_recovery_attempts + 1
        WHERE
          recovery_id = ?;`,
        [recoveryDetails.recovery_id]
      );

      if (recoveryDetails.failed_recovery_attempts + 1 >= FAILED_ACCOUNT_UPDATE_LIMIT) {
        res.status(401).json({
          message: 'Incorrect recovery code.',
          reason: 'recoverySuspended',
          requestData: {
            expiryTimestamp: recoveryDetails.expiry_timestamp,
          },
        });

        return;
      };

      res.status(401).json({ message: 'Incorrect recovery code.', reason: 'incorrectRecoveryCode' });
      return;
    };

    if (recoveryDetails.username === requestData.newPassword) {
      res.status(409).json({ message: `New password can't be identical to username.` });
      return;
    };

    const newHashedPassword: string = await bcrypt.hash(requestData.newPassword, 10);
    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        hashed_password = ?,
        failed_sign_in_attempts = ?
      WHERE
        account_id = ?;`,
      [newHashedPassword, 0, requestData.accountId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    await dbPool.execute(
      `DELETE FROM
        account_recovery
      WHERE
        recovery_id = ?;`,
      [recoveryDetails.recovery_id]
    );

    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: requestData.accountId,
      user_type: 'account',
      keepSignedIn: false,
    });

    res.json({ authSessionCreated });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.delete(`/deletion/start`, async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['password'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(400).json({ message: 'Invalid password.' });
    return;
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession('authSessionId');
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface AccountDetails extends RowDataPacket {
      email: string,
      hashed_password: string,
      display_name: string,
      failed_sign_in_attempts: number,
      expiry_timestamp: number,
      failed_deletion_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.email,
        accounts.hashed_password,
        accounts.display_name,
        accounts.failed_sign_in_attempts,
        account_deletion.expiry_timestamp,
        account_deletion.failed_deletion_attempts
      FROM
        accounts
      WHERE
        account_id = ?`,
      [authSessionDetails.user_id]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    if (!accountDetails.expiry_timestamp) {
      const confirmationCode: string = generateRandomCode();

      const expiryTimestamp: number = Date.now() + ACCOUNT_DELETION_WINDOW;

      await dbPool.execute(
        `INSERT INTO account_deletion (
        account_id,
        confirmation_code,
        expiry_timestamp,
        failed_deletion_attempts
      ) VALUES (${generatePlaceHolders(3)});`,
        [authSessionDetails.user_id, confirmationCode, expiryTimestamp]
      );

      res.json({});

      await sendDeletionConfirmationEmail({
        to: accountDetails.email,
        confirmationCode,
        displayName: accountDetails.display_name,
      });

      return;
    };

    const requestSuspended: boolean = accountDetails.failed_deletion_attempts >= FAILED_ACCOUNT_UPDATE_LIMIT;
    if (requestSuspended) {
      res.status(403).json({
        message: 'Deletion request suspended.',
        reason: 'requestSuspended',
        resData: { expiryTimestamp: accountDetails.expiry_timestamp },
      });

      return;
    };

    res.status(409).json({
      message: 'Deletion request detected.',
      reason: 'requestDetected',
      resData: { expiryTimestamp: accountDetails.expiry_timestamp, failedDeletionAttempts: accountDetails.failed_deletion_attempts },
    });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.delete('/deletion/confirm', async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
    confirmationCode: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['password', 'confirmationCode'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(400).json({ message: 'Invalid password.', reason: 'invalidPassword' });
    return;
  };

  if (!userValidation.isValidRandomCode(requestData.confirmationCode)) {
    res.status(400).json({ message: 'Invalid confirmation code.', reason: 'invalidCode' });
    return;
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface AccountDetails extends RowDataPacket {
      hashed_password: string,
      failed_sign_in_attempts: number,
      email: string,
      display_name: string,
      deletion_id: number,
      confirmation_code: string,
      expiry_timestamp: number,
      failed_deletion_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.hashed_password,
        accounts.failed_sign_in_attempts,
        accounts.email,
        accounts.display_name,
        account_deletion.deletion_id,
        account_deletion.confirmation_code,
        account_deletion.request_timestamp,
        account_deletion.failed_deletion_attempts
      FROM
        accounts
      LEFT JOIN
        account_deletion ON accounts.account_id = account_deletion.account_id
      WHERE
        accounts.account_id = ?;
      LIMIT 1;`,
      [authSessionDetails.user_id]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    if (!accountDetails.deletion_id) {
      res.status(404).json({ message: 'Deletion request not found.' });
      return;
    };

    const requestSuspended: boolean = accountDetails.failed_deletion_attempts >= FAILED_ACCOUNT_UPDATE_LIMIT;
    if (requestSuspended) {
      res.status(403).json({
        message: 'Deletion request suspended.',
        reason: 'requestSuspended',
        resData: { expiryTimestamp: accountDetails.expiry_timestamp },
      });

      return;
    };

    const isCorrectConfirmationCode: boolean = accountDetails.confirmation_code === requestData.confirmationCode;
    if (!isCorrectConfirmationCode) {
      const toBeSuspended: boolean = accountDetails.failed_deletion_attempts + 1 >= FAILED_ACCOUNT_UPDATE_LIMIT;

      if (toBeSuspended) {
        await purgeAuthSessions(authSessionDetails.user_id, 'account');
        removeRequestCookie(res, 'authSessionId');
      };

      const expiryTimestampValue: number = toBeSuspended
        ? Date.now() + ACCOUNT_DELETION_SUSPENSION_WINDOW
        : accountDetails.expiry_timestamp;

      await dbPool.execute(
        `UPDATE
          account_deletion
        SET
          failed_deletion_attempts = failed_deletion_attempts + 1,
          expiry_timestamp = ?
        WHERE
          deletion_id = ?;`,
        [expiryTimestampValue, accountDetails.deletion_id]
      );

      res.status(401).json({
        message: 'Incorrect confirmation code.',
        reason: toBeSuspended ? 'requestSuspended' : 'incorrectCode',
        resData: toBeSuspended ? { expiryTimestamp: accountDetails.expiry_timestamp } : undefined,
      });

      if (toBeSuspended) {
        await sendDeletionWarningEmail({
          to: accountDetails.email,
          displayName: accountDetails.display_name,
        });
      };

      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        accounts
      WHERE
        account_id = ?;`,
      [authSessionDetails.user_id]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    res.json({});

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.patch('/details/updatePassword', async (req: Request, res: Response) => {
  interface RequestData {
    currentPassword: string,
    newPassword: string
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['currentPassword', 'newPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.currentPassword)) {
    res.status(400).json({ message: 'Invalid password.' });
    return;
  };

  if (!userValidation.isValidNewPassword(requestData.newPassword)) {
    res.status(400).json({ message: 'Invalid new password.' });
    return;
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        accounts
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface AccountDetails extends RowDataPacket {
      hashed_password: string,
      failed_sign_in_attempts: number,
      username: string,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        hashed_password,
        failed_sign_in_attempts,
        username
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [authSessionDetails.user_id]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.currentPassword, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    const areIdenticalPasswords: boolean = await bcrypt.compare(requestData.newPassword, accountDetails.hashed_password);
    if (areIdenticalPasswords) {
      res.status(409).json({
        message: `New password can't be identical to current password.`,
        reason: 'identicalPasswords'
      });

      return;
    };

    if (accountDetails.username === requestData.newPassword) {
      res.status(409).json({ message: `New password can't be identical to username.`, reason: 'passwordEqualsUsername' });
      return;
    };

    const newHashedPassword: string = await bcrypt.hash(requestData.newPassword, 10);
    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        hashed_password = ?
      WHERE
        account_id = ?;`,
      [newHashedPassword, authSessionDetails.user_id]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    await purgeAuthSessions(authSessionDetails.user_id, 'account');
    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: authSessionDetails.user_id,
      user_type: 'account',
      keepSignedIn: false,
    });

    res.json({ authSessionCreated });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.post('/details/updateEmail/start', async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
    newEmail: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['password', 'newEmail'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmail(requestData.newEmail)) {
    res.status(400).json({ message: 'Invalid email address.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(400).json({ message: 'Invalid password.' });
    return;
  };

  let connection;

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface AccountDetails extends RowDataPacket {
      hashed_password: string,
      email: string,
      display_name: string,
      failed_sign_in_attempts: number,
      expiry_timestamp: number,
      failed_update_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.hashed_password,
        accounts.email,
        accounts.display_name,
        accounts.failed_sign_in_attempts,
        email_update.expiry_timestamp,
        email_update.failed_update_attempts
      FROM
        accounts
      LEFT JOIN
        email_update ON accounts.account_id = email_update.account_id
      WHERE
        accounts.account_id = ?;`,
      [authSessionDetails.user_id]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    if (accountDetails.expiry_timestamp) {
      if (accountDetails.failed_update_attempts >= FAILED_ACCOUNT_UPDATE_LIMIT) {
        res.status(403).json({
          message: 'Request is suspended due to too many failed attempts.',
          reason: 'requestSuspended',
          resData: { expiryTimestamp: accountDetails.expiry_timestamp },
        });

        return;
      };

      res.status(409).json({
        message: 'Ongoing email update request found.',
        reason: 'ongoingRequest',
        resData: { expiryTimestamp: accountDetails.expiry_timestamp },
      });

      return;
    };

    if (requestData.newEmail === accountDetails.email) {
      res.status(409).json({ message: 'This email is already assigned to your account.', reason: 'identicalEmail' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    const [emailRows] = await connection.execute<RowDataPacket[]>(
      `(SELECT 1 FROM accounts WHERE email = :newEmail LIMIT 1)
      UNION ALL
      (SELECT 1 FROM email_update WHERE new_email = :newEmail LIMIT 1);`,
      { newEmail: requestData.newEmail }
    );

    if (emailRows.length > 0) {
      await connection.rollback();
      res.status(409).json({ message: 'Email address is already taken.', reason: 'emailTaken' });

      return;
    };

    const newVerificationCode: string = generateRandomCode();
    const expiryTimestamp: number = Date.now() + ACCOUNT_EMAIL_UPDATE_WINDOW;

    await connection.execute(
      `INSERT INTO email_update (
          account_id,
          new_email,
          verification_code,
          expiry_timestamp,
          update_emails_sent,
          failed_update_attempts
        ) VALUES (${generatePlaceHolders(6)});`,
      [authSessionDetails.user_id, requestData.newEmail, newVerificationCode, expiryTimestamp, 1, 0]
    );

    await connection.commit();
    res.json({});

    await sendEmailUpdateEmail({
      to: requestData.newEmail,
      verificationCode: newVerificationCode,
      displayName: accountDetails.display_name,
    });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

accountsRouter.get('/details/updateEmail/resendEmail', async (req: Request, res: Response) => {
  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface EmailUpdateDetails extends RowDataPacket {
      new_email: string,
      verification_code: string,
      expiry_timestamp: number,
      update_emails_sent: number,
      failed_update_attempts: number,
      display_name: string,
    };

    const [emailUpdateRows] = await dbPool.execute<EmailUpdateDetails[]>(
      `SELECT
        new_email,
        verification_code,
        expiry_timestamp,
        update_emails_sent,
        failed_update_attempts,
        (SELECT display_name FROM accounts WHERE account_id = :accountId) AS display_name
      FROM
        email_update
      WHERE
        account_id = :accountId
      LIMIT 1;`,
      { accountId: authSessionDetails.user_id }
    );

    const emailUpdateDetails: EmailUpdateDetails | undefined = emailUpdateRows[0];

    if (!emailUpdateDetails) {
      res.status(404).json({ message: 'Email update request not found.' });
      return;
    };

    if (emailUpdateDetails.failed_update_attempts >= FAILED_ACCOUNT_UPDATE_LIMIT) {
      res.status(403).json({
        message: 'Request is suspended due to too many failed attempts.',
        reason: 'requestSuspended',
        resData: { expiryTimestamp: emailUpdateDetails.expiry_timestamp },
      });

      return;
    };

    if (emailUpdateDetails.update_emails_sent >= EMAILS_SENT_LIMIT) {
      res.status(409).json({ message: 'Update emails limit reached.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        email_update
      SET
        update_emails_sent = update_emails_sent + 1
      WHERE
        account_id = ?
      LIMIT 1;`,
      [authSessionDetails.user_id]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    res.json({});

    await sendEmailUpdateEmail({
      to: emailUpdateDetails.newEmail,
      verificationCode: emailUpdateDetails.verification_code,
      displayName: emailUpdateDetails.display_name,
    });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.patch('/details/updateEmail/confirm', async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
    verificationCode: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['password', 'verificationCode'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(401).json({ message: 'Invalid password.' });
    return;
  };

  if (!userValidation.isValidRandomCode(requestData.verificationCode)) {
    res.status(400).json({ message: 'Invalid verification code.' });
    return;
  };

  let connection;

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        sessions_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface AccountDetails extends RowDataPacket {
      email: string,
      hashed_password: string,
      failed_sign_in_attempts: number,
      display_name: string,
      update_id: number,
      new_email: string,
      verification_code: string,
      expiry_timestamp: number,
      failed_update_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.email,
        accounts.hashed_password,
        accounts.failed_sign_in_attempts,
        accounts.display_name,
        email_update.update_id,
        email_update.new_email,
        email_update.verification_code,
        email_update.expiry_timestamp,
        email_update.failed_update_attempts
      FROM
        accounts
      LEFT JOIN
        email_update ON accounts.account_id = email_update.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`,
      [authSessionDetails.user_id]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (!accountDetails.update_id) {
      res.status(404).json({ message: 'Email update request not found.' });
      return;
    };

    if (accountDetails.failed_update_attempts >= FAILED_ACCOUNT_UPDATE_LIMIT) {
      res.status(403).json({
        message: 'Email update request suspended.',
        reason: 'requestSuspended.',
        resData: { expiryTimestamp: accountDetails.expiry_timestamp },
      });

      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    if (requestData.verificationCode !== accountDetails.verification_code) {
      const requestSuspended: boolean = accountDetails.failed_update_attempts + 1 >= FAILED_ACCOUNT_UPDATE_LIMIT;
      const suspendRequestQuery: string = requestSuspended ? `, expiry_timestamp = ${Date.now() + ACCOUNT_EMAIL_UPDATE_WINDOW}` : '';

      await dbPool.execute(
        `UPDATE
            email_update
          SET
            failed_update_attempts = failed_update_attempts + 1
            ${suspendRequestQuery}
          WHERE
            update_id = ?;`,
        [Date.now(), accountDetails.update_id]
      );

      if (requestSuspended) {
        await purgeAuthSessions(authSessionDetails.user_id, 'account');
        removeRequestCookie(res, 'authSessionId');
      };

      res.status(401).json({
        message: 'Incorrect verification code.',
        reason: requestSuspended ? 'requestSuspended' : 'incorrectCode',
      });

      if (requestSuspended) {
        await sendEmailUpdateWarningEmail(accountDetails.email, accountDetails.display_name);
      };

      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const [firstResultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        email = ?
      WHERE
        account_id = ?;`,
      [accountDetails.new_email, authSessionDetails.user_id]
    );

    if (firstResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ message: 'Internal server error.' });

      return;
    };

    const [secondResultSetHeader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        email_update
      WHERE
        account_id = ?
      LIMIT 1;`,
      [authSessionDetails.user_id]
    );

    if (secondResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ message: 'Internal server error.' });

      return;
    };

    await connection.commit();

    await purgeAuthSessions(authSessionDetails.user_id, 'account');
    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: authSessionDetails.user_id,
      user_type: 'account',
      keepSignedIn: false,
    });

    res.json({ authSessionCreated });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

accountsRouter.patch('/details/updateDisplayName', async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
    newDisplayName: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['password', 'newDisplayName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(400).json({ message: 'Invalid password.' });
    return;
  };

  let connection;

  if (!userValidation.isValidDisplayName(requestData.newDisplayName)) {
    res.status(400).json({ message: 'Invalid display name.' });
    return;
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface AccountDetails extends RowDataPacket {
      hashed_password: string,
      failed_sign_in_attempts: number,
      display_name: string,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        hashed_password,
        failed_sign_in_attempts,
        display_name
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [authSessionDetails.user_id]
    );

    const accountDetails: AccountDetails | undefined = accountRows[0];

    if (!accountDetails) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    if (requestData.newDisplayName === accountDetails.display_name) {
      res.status(409).json({ message: `New display name can't be identical to current display name` });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        display_name = ?
      WHERE
        account_id = ?;`,
      [requestData.newDisplayName, authSessionDetails.user_id]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ message: 'Internal server error.' });

      return;
    };

    await connection.execute(
      `UPDATE
        hangout_members
      SET
        display_name = ?
      WHERE
        account_id = ?;`,
      [requestData.newDisplayName, authSessionDetails.user_id]
    );

    await connection.commit();
    res.json({ newDisplayName: requestData.newDisplayName });

    interface HangoutMemberDetails extends RowDataPacket {
      hangout_member_id: number,
      hangout_id: string,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangout_member_id,
        hangout_id
      FROM
        hangout_members
      WHERE
        account_id = ?;`,
      [authSessionDetails.user_id]
    );

    if (hangoutMemberRows.length === 0) {
      return;
    };

    const eventTimestamp: number = Date.now();
    const eventDescription: string = `${accountDetails.display_name} changed his name to ${requestData.newDisplayName}.`;

    for (const row of hangoutMemberRows) {
      sendHangoutWebSocketMessage([row.hangout_id], {
        type: 'misc',
        reason: 'memberUpdatedDisplayName',
        data: {
          hangoutMemberId: row.hangout_member_id,
          newDisplayName: requestData.newDisplayName,

          eventTimestamp,
          eventDescription,
        },
      });
    };

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

accountsRouter.post('/friends/requests/send', async (req: Request, res: Response) => {
  interface RequestData {
    requesteeUsername: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['requesteeUsername'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidUsername(requestData.requesteeUsername)) {
    res.status(400).json({ message: 'Invalid requestee username.' });
    return;
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface RequesteeDetails extends RowDataPacket {
      requestee_id: number,
    };

    const [requesteeRows] = await dbPool.execute<RequesteeDetails[]>(
      `SELECT
        account_id AS requestee_id
      FROM
        accounts
      WHERE
        username = ?
      LIMIT 1;`,
      [requestData.requesteeUsername, authSessionDetails.user_id]
    );

    const requesteeId: number | undefined = requesteeRows[0]?.requestee_id;

    if (!requesteeId) {
      res.status(404).json({ message: 'User not found.' });
      return;
    };

    if (requesteeId === authSessionDetails.user_id) {
      res.status(409).json({ message: 'Can not add yourself as a friend.' });
      return;
    };

    interface AlreadyFriends extends RowDataPacket { already_friends: 1 | null };
    interface RequestAlreadySent extends RowDataPacket { request_already_sent: 1 | null };

    type FriendshipDetails = [
      AlreadyFriends[],
      RequestAlreadySent[],
    ];

    const [friendshipRows] = await dbPool.query<FriendshipDetails>(
      `SELECT
        1 AS already_friends
      FROM
        friendships
      WHERE
        account_id = :accountId AND
        friend_id = :requesteeId
      LIMIT 1;
      
      SELECT
        1 AS request_already_sent
      FROM
        friend_requests
      WHERE
        requester_id = :accountId AND
        requestee_id = :requesteeId
      LIMIT 1;`,
      { accountId: authSessionDetails.user_id, requesteeId }
    );

    if (friendshipRows.length !== 2) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    const alreadyFriends: boolean = friendshipRows[0][0] ? friendshipRows[0][0].already_friends === 1 : false;
    const requestAlreadySent: boolean = friendshipRows[1][0] ? friendshipRows[1][0].request_already_sent === 1 : false;

    if (alreadyFriends) {
      res.status(409).json({ message: 'Already friends.' });
      return;
    };

    if (requestAlreadySent) {
      res.status(409).json({ message: 'Friend request already sent.' });
      return;
    };

    await dbPool.execute(
      `INSERT INTO friend_requests (
        requester_id,
        requestee_id,
        request_timestamp
      ) VALUES (${generatePlaceHolders(3)});`,
      [authSessionDetails.user_id, requesteeId, Date.now()]
    );

    res.json({});
    return;

  } catch (err: unknown) {
    console.log(err);

    if (!isSqlError(err)) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    if (err.errno === 1062) {
      res.status(409).json({ message: 'Friend request already sent.' });
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.post('/friends/requests/accept', async (req: Request, res: Response) => {
  interface RequestData {
    friendRequestId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['friendRequestId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendRequestId)) {
    res.status(400).json({ message: 'Invalid friend request ID.' });
    return;
  };

  let connection;

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface FriendRequestDetails extends RowDataPacket {
      requester_id: number,
    };

    const [friendRequestRows] = await dbPool.execute<FriendRequestDetails[]>(
      `SELECT
        requester_id
      FROM
        friend_requests
      WHERE
        request_id = ?;`,
      [requestData.friendRequestId]
    );

    const requesterId: number | undefined = friendRequestRows[0]?.requester_id;

    if (!requesterId) {
      res.status(404).json({ message: 'Friend request not found.' });
      return;
    };

    const friendshipTimestamp: number = Date.now();

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO friendships (
        first_account_id,
        second_account_id,
        friendship_timestamp
      ) VALUES (${generatePlaceHolders(3)});`,
      [authSessionDetails.user_id, requesterId, friendshipTimestamp]
    );

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        friend_requests
      WHERE
        (requester_id = :requesterId AND requestee_id = :accountId) OR
        (requester_id = :accountId AND requestee_id = :requesterId)
      LIMIT 2;`,
      { accountId: authSessionDetails.user_id, requesterId }
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({});

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (!isSqlError(err)) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    const sqlError: SqlError = err;

    if (sqlError.errno === 1062) {
      res.status(409).json({ message: 'Already friends.' });
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

accountsRouter.delete('/friends/requests/decline', async (req: Request, res: Response) => {
  interface RequestData {
    friendRequestId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['friendRequestId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendRequestId)) {
    res.status(400).json({ message: 'Invalid friend request ID.' });
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        friend_requests
      WHERE
        request_id = ?;`,
      [requestData.friendRequestId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(404).json({ message: 'Friend request not found.' });
      return;
    };

    res.json({});

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});

accountsRouter.delete('/friends/manage/remove', async (req: Request, res: Response) => {
  interface RequestData {
    friendshipId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['friendshipId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendshipId)) {
    res.status(400).json({ message: 'Invalid friendship ID.' });
    return;
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface FriendshipDetails extends RowDataPacket {
      friend_id: number,
    };

    const [friendshipRows] = await dbPool.execute<FriendshipDetails[]>(
      `SELECT
        friend_id
      FROM
        friendships
      WHERE
        friendship_id = ?;`,
      [requestData.friendshipId]
    );

    const friendId: number | undefined = friendshipRows[0]?.friend_id;

    if (!friendId) {
      res.status(404).json({ message: 'Friend not found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        friendships
      WHERE
        (account_id = :accountId AND friend_id = :friendId) OR
        (account_id = :friendId AND friend_id = :accountId)
      LIMIT 2;`,
      { accountId: authSessionDetails.user_id, friendId }
    );

    if (resultSetHeader.affectedRows !== 2) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    res.json({});

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
});