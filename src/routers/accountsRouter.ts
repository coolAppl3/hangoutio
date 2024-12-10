import express, { Router, Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { dbPool } from '../db/db';
import bcrypt from 'bcrypt';
import * as userValidation from '../util/validation/userValidation';
import { generateUniqueCode, generateUniqueToken } from '../util/tokenGenerator';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { sendDeletionConfirmationEmail, sendDeletionWarningEmail, sendEmailUpdateEmail, sendEmailUpdateWarningEmail, sendRecoveryEmail, sendVerificationEmail } from '../util/email/emailServices';
import { generatePlaceHolders } from '../util/generatePlaceHolders';
import * as userUtils from '../util/userUtils';
import { isSqlError } from '../util/isSqlError';
import { createAuthSession, destroyAuthSession, purgeAuthSessions } from '../auth/authSessions';
import { removeRequestCookie, getRequestCookie } from '../util/cookieUtils';
import * as authUtils from '../auth/authUtils';
import { handleIncorrectAccountPassword } from '../util/accountServices';

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
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmail(requestData.email)) {
    res.status(400).json({ success: false, message: 'Invalid email address.', reason: 'email' });
    return;
  };

  if (!userValidation.isValidDisplayName(requestData.displayName)) {
    res.status(400).json({ success: false, message: 'Invalid display name.', reason: 'displayName' });
    return;
  };

  if (!userValidation.isValidUsername(requestData.username)) {
    res.status(400).json({ success: false, message: 'Invalid username.', reason: 'username' });
    return;
  };

  if (!userValidation.isValidNewPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.', reason: 'password' });
    return;
  };

  if (requestData.username === requestData.password) {
    res.status(409).json({ success: false, message: `Password can't be identical to username.`, reason: 'passwordEqualsUsername' });
    return;
  };

  const existingAuthSessionId: string | null = getRequestCookie(req, 'authSessionId');
  if (existingAuthSessionId) {
    res.status(403).json({ success: false, message: 'You must sign out before creating a new account.', reason: 'signedIn' });
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
      (SELECT 2 AS taken_status FROM accounts WHERE username = :username LIMIT 1);`,
      { email: requestData.email, username: requestData.username }
    );

    if (emailUsernameRows.length > 0) {
      await connection.rollback();

      const takenDataSet: Set<number> = new Set();
      emailUsernameRows.forEach((row) => takenDataSet.add(row.taken_status));

      if (takenDataSet.has(1) && takenDataSet.has(2)) {
        res.status(409).json({
          success: false,
          message: 'Email address and username are both already taken.',
          reason: 'emailAndUsernameTaken',
        });

        return;
      };

      if (takenDataSet.has(1)) {
        res.status(409).json({ success: false, message: 'Email address is already taken.', reason: 'emailTaken' });
        return;
      };

      if (takenDataSet.has(2)) {
        res.status(409).json({ success: false, message: 'Username is already taken.', reason: 'usernameTaken' });
        return;
      };

      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    const verificationCode: string = generateUniqueCode();
    const hashedPassword: string = await bcrypt.hash(requestData.password, 10);
    const createdOnTimestamp: number = Date.now();

    const verificationWindowMilliseconds: number = 1000 * 60 * 20;
    const verificationExpiryTimestamp: number = createdOnTimestamp + verificationWindowMilliseconds;

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO accounts(
        email,
        hashed_password,
        username,
        display_name,
        created_on_timestamp,
        is_verified,
        failed_sign_in_attempts,
        marked_for_deletion
      )
      VALUES(${generatePlaceHolders(8)});`,
      [requestData.email, hashedPassword, requestData.username, requestData.displayName, createdOnTimestamp, false, 0, false]
    );

    const accountId: number = resultSetHeader.insertId;

    await connection.execute(
      `INSERT INTO account_verification(
        account_id,
        verification_code,
        verification_emails_sent,
        failed_verification_attempts,
        expiry_timestamp
      )
      VALUES(${generatePlaceHolders(5)});`,
      [accountId, verificationCode, 1, 0, verificationExpiryTimestamp]
    );

    await connection.commit();
    res.status(201).json({ success: true, resData: { accountId, verificationExpiryTimestamp } });

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
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    const sqlError: SqlError = err;

    if (sqlError.errno === 1062 && sqlError.sqlMessage?.endsWith(`for key 'email'`)) {
      res.status(409).json({ success: false, message: 'Email address is already taken.', reason: 'emailTaken' });
      return;
    };

    if (sqlError.errno === 1062 && sqlError.sqlMessage?.endsWith(`for key 'username'`)) {
      res.status(409).json({ success: false, message: 'Username is already taken.', reason: 'usernameTaken' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

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
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountId)) {
    res.status(400).json({ success: false, message: 'Invalid account ID.', reason: 'accountId' });
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

    if (accountRows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (accountDetails.is_verified) {
      res.status(409).json({ success: false, message: 'Account already verified.', reason: 'alreadyVerified' });
      return;
    };

    if (!accountDetails.verification_id) {
      res.status(404).json({ success: false, message: 'Verification request not found.' });
      return;
    };

    if (accountDetails.verification_emails_sent >= 3) {
      res.status(403).json({ success: false, message: 'Verification emails limit reached.', reason: 'limitReached' });
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
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: { verificationEmailsSent: accountDetails.verification_emails_sent } });

    await sendVerificationEmail({
      to: accountDetails.email,
      accountId: requestData.accountId,
      verificationCode: accountDetails.verification_code,
      displayName: accountDetails.display_name,
      expiryTimestamp: accountDetails.expiry_timestamp,
    });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
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
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountId)) {
    res.status(400).json({ success: false, message: 'Invalid account ID.', reason: 'accountId' });
    return;
  };

  if (!userValidation.isValidCode(requestData.verificationCode)) {
    res.status(400).json({ success: false, message: 'Invalid verification code.', reason: 'verificationCode' });
    return;
  };

  const existingAuthSessionId: string | null = getRequestCookie(req, 'authSessionId');
  if (existingAuthSessionId) {
    res.status(403).json({ success: false, message: 'You must sign out before proceeding.', reason: 'signedIn' });
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

    if (accountRows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (accountDetails.is_verified) {
      res.status(409).json({ success: false, message: 'Account already verified.' });
      return;
    };

    const isCorrectVerificationCode: boolean = requestData.verificationCode == accountDetails.verification_code;
    if (!isCorrectVerificationCode) {
      if (accountDetails.failed_verification_attempts + 1 >= 3) {
        await dbPool.execute(
          `DELETE FROM
            accounts
          WHERE
            account_id = ?;`,
          [requestData.accountId]
        );

        res.status(401).json({ success: false, message: 'Incorrect verification code.', reason: 'accountDeleted' });
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

      res.status(401).json({ success: false, message: 'Incorrect verification code.' });
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
      res.status(500).json({ success: false, message: 'Internal server error.' });

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
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();

    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: requestData.accountId,
      user_type: 'account',
      keepSignedIn: false,
    });

    res.json({ success: true, resData: { authSessionCreated } });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    res.status(500).json({ success: false, message: 'Internal server error.' });

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

  const expectedKeys: string[] = ['email', 'password'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmail(requestData.email)) {
    res.status(400).json({ success: false, message: 'Invalid email address.', reason: 'email' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid account password.', reason: 'password' });
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
      marked_for_deletion: boolean,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        account_id,
        hashed_password,
        is_verified,
        failed_sign_in_attempts,
        marked_for_deletion
      FROM
        accounts
      WHERE
        email = ?
      LIMIT 1;`,
      [requestData.email]
    );

    if (accountRows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (accountDetails.marked_for_deletion) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    if (accountDetails.failed_sign_in_attempts >= 5) {
      res.status(403).json({ success: false, message: 'Account locked.', reason: 'accountLocked' });
      return;
    };

    if (!accountDetails.is_verified) {
      res.status(403).json({ success: false, message: 'Account unverified.', reason: 'unverified' });
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
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.post('/recovery/sendEmail', async (req: Request, res: Response) => {
  interface RequestData {
    email: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['email'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmail(requestData.email)) {
    res.status(400).json({ success: false, message: 'Invalid email address.', reason: 'email' });
    return;
  };

  const existingAuthSessionId: string | null = getRequestCookie(req, 'authSessionId');
  if (existingAuthSessionId) {
    res.status(403).json({ success: false, message: `Can't recover account while signed in.`, reason: 'signedIn' });
    return;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      account_id: number,
      display_name: string,
      is_verified: boolean,
      marked_for_deletion: boolean,
      recovery_id: number,
      recovery_token: string,
      expiry_timestamp: number,
      recovery_emails_sent: number,
      failed_recovery_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.account_id,
        accounts.display_name,
        accounts.is_verified,
        accounts.marked_for_deletion,
        account_recovery.recovery_id,
        account_recovery.recovery_token,
        account_recovery.expiry_timestamp,
        account_recovery.recovery_emails_sent,
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

    if (accountRows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (accountDetails.marked_for_deletion) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    if (!accountDetails.is_verified) {
      res.status(403).json({ success: false, message: 'Account unverified.', reason: 'unverified' });
      return;
    };

    if (!accountDetails.recovery_id) {
      const recoveryToken: string = generateUniqueToken();

      const hourMilliseconds: number = 1000 * 60 * 60;
      const expiryTimestamp: number = Date.now() + hourMilliseconds;

      await dbPool.execute(
        `INSERT INTO account_recovery(
          account_id,
          recovery_token,
          expiry_timestamp,
          recovery_emails_sent,
          failed_recovery_attempts
        )
        VALUES(${generatePlaceHolders(5)});`,
        [accountDetails.account_id, recoveryToken, expiryTimestamp, 1, 0]
      );

      res.json({ success: true, resData: { expiryTimestamp } });

      await sendRecoveryEmail({
        to: requestData.email,
        accountId: accountDetails.account_id,
        recoveryToken,
        expiryTimestamp,
        displayName: accountDetails.display_name,
      });

      return;
    };

    if (accountDetails.recovery_emails_sent >= 3) {
      res.status(403).json({
        success: false,
        message: 'Recovery email limit has been reached.',
        reason: 'emailLimitReached',
        resData: {
          expiryTimestamp: accountDetails.expiry_timestamp,
        },
      });

      return;
    };

    if (accountDetails.failed_recovery_attempts >= 3) {
      res.status(403).json({
        success: false,
        message: 'Too many failed recovery attempts.',
        reason: 'failureLimitReached',
        resData: {
          expiryTimestamp: accountDetails.expiry_timestamp,
        },
      });

      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        account_recovery
      SET
        recovery_emails_sent = recovery_emails_sent + 1
      WHERE
        recovery_id = ?;`,
      [accountDetails.recovery_id]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: { expiryTimestamp: accountDetails.expiry_timestamp } });

    await sendRecoveryEmail({
      to: requestData.email,
      accountId: accountDetails.account_id,
      recoveryToken: accountDetails.recovery_token,
      expiryTimestamp: accountDetails.expiry_timestamp,
      displayName: accountDetails.display_name,
    });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.patch('/recovery/updatePassword', async (req: Request, res: Response) => {
  interface RequestData {
    accountId: number,
    recoveryToken: string,
    newPassword: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['accountId', 'recoveryToken', 'newPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountId)) {
    res.status(400).json({ success: false, message: 'Invalid account ID.', reason: 'accountId' });
    return;
  };

  if (!userValidation.isValidUniqueToken(requestData.recoveryToken)) {
    res.status(400).json({ success: false, message: 'Invalid recovery token.', reason: 'recoveryToken' });
    return;
  };

  if (!userValidation.isValidNewPassword(requestData.newPassword)) {
    res.status(400).json({ success: false, message: 'Invalid new password.', reason: 'password' });
    return;
  };

  const existingAuthSessionId: string | null = getRequestCookie(req, 'authSessionId');
  if (existingAuthSessionId) {
    res.status(403).json({ success: false, message: `Can't recover account while signed in.`, reason: 'signedIn' });
    return;
  };

  try {
    interface RecoveryDetails extends RowDataPacket {
      recovery_id: number,
      recovery_token: string,
      failed_recovery_attempts: number,
      expiry_timestamp: number,
      username: string,
    };

    const [recoveryRows] = await dbPool.execute<RecoveryDetails[]>(
      `SELECT
        recovery_id,
        recovery_token,
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

    if (recoveryRows.length === 0) {
      res.status(404).json({ success: false, message: 'Recovery request not found or has expired.' });
      return;
    };

    const recoveryDetails: RecoveryDetails = recoveryRows[0];

    if (recoveryDetails.failed_recovery_attempts >= 3) {
      res.status(403).json({
        success: false,
        message: 'Too many failed recovery attempts.',
        reason: 'failureLimitReached',
        resData: {
          expiryTimestamp: recoveryDetails.expiry_timestamp,
        },
      });

      return;
    };

    if (requestData.recoveryToken !== recoveryDetails.recovery_token) {
      await dbPool.execute(
        `UPDATE
          account_recovery
        SET
          failed_recovery_attempts = failed_recovery_attempts + 1
        WHERE
          recovery_id = ?;`,
        [recoveryDetails.recovery_id]
      );

      if (recoveryDetails.failed_recovery_attempts + 1 >= 3) {
        res.status(401).json({
          success: false,
          message: 'Incorrect recovery token. Recovery suspended',
          reason: 'recoverySuspended',
          requestData: {
            expiryTimestamp: recoveryDetails.expiry_timestamp,
          },
        });

        return;
      };

      res.status(401).json({ success: false, message: 'Incorrect recovery token.', reason: 'incorrectRecoveryToken' });
      return;
    };

    if (recoveryDetails.username === requestData.newPassword) {
      res.status(409).json({ success: false, message: `New password can't be identical to username.` });
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
      res.status(500).json({ success: false, message: 'Internal server error.' });
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

    res.json({ success: true, resData: { authSessionCreated } });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.delete(`/deletion/start`, async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['password'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
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

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession('authSessionId');
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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

    if (accountRows.length === 0) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    if (!accountDetails.expiry_timestamp) {
      const confirmationCode: string = generateUniqueCode();

      const hourMilliseconds: number = 1000 * 60 * 60;
      const expiryTimestamp: number = Date.now() + hourMilliseconds;

      await dbPool.execute(
        `INSERT INTO account_deletion(
        account_id,
        confirmation_code,
        expiry_timestamp,
        failed_deletion_attempts
      )
      VALUES(${generatePlaceHolders(3)});`,
        [authSessionDetails.user_id, confirmationCode, expiryTimestamp]
      );

      res.json({ success: true, resData: {} });

      await sendDeletionConfirmationEmail({
        to: accountDetails.email,
        confirmationCode,
        displayName: accountDetails.display_name,
      });

      return;
    };

    const requestSuspended: boolean = accountDetails.failed_deletion_attempts >= 3;
    if (requestSuspended) {
      res.status(403).json({
        success: false,
        message: 'Deletion request suspended.',
        reason: 'requestSuspended',
        resData: { expiryTimestamp: accountDetails.expiry_timestamp },
      });

      return;
    };

    res.status(409).json({
      success: false,
      message: 'Deletion request detected.',
      reason: 'requestDetected',
      resData: { expiryTimestamp: accountDetails.expiry_timestamp, failedDeletionAttempts: accountDetails.failed_deletion_attempts },
    });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.delete('/deletion/confirm', async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
    confirmationCode: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['password', 'confirmationCode'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.', reason: 'invalidPassword' });
    return;
  };

  if (!userValidation.isValidCode(requestData.confirmationCode)) {
    res.status(400).json({ success: false, message: 'Invalid confirmation code.', reason: 'invalidCode' });
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

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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

    if (accountRows.length === 0) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    if (!accountDetails.deletion_id) {
      res.status(404).json({ success: false, message: 'Deletion request not found.' });
      return;
    };

    const requestSuspended: boolean = accountDetails.failed_deletion_attempts >= 3;
    if (requestSuspended) {
      res.status(403).json({
        success: false,
        message: 'Deletion request suspended.',
        reason: 'requestSuspended',
        resData: { expiryTimestamp: accountDetails.expiry_timestamp },
      });

      return;
    };

    const isCorrectConfirmationCode: boolean = accountDetails.confirmation_code === requestData.confirmationCode;
    if (!isCorrectConfirmationCode) {
      const toBeSuspended: boolean = accountDetails.failed_deletion_attempts + 1 >= 3;

      if (toBeSuspended) {
        await purgeAuthSessions(authSessionDetails.user_id, 'account');
        removeRequestCookie(res, 'authSessionId', true);
      };

      const dayMilliseconds: number = 1000 * 60 * 60 * 24;
      const expiryTimestampValue: number = toBeSuspended ? Date.now() + dayMilliseconds : accountDetails.expiry_timestamp;

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
        success: false,
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
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.patch('/details/updatePassword', async (req: Request, res: Response) => {
  interface RequestData {
    currentPassword: string,
    newPassword: string
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['currentPassword', 'newPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.currentPassword)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  if (!userValidation.isValidNewPassword(requestData.newPassword)) {
    res.status(400).json({ success: false, message: 'Invalid new password.' });
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

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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

    if (accountRows.length === 0) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.currentPassword, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    const areIdenticalPasswords: boolean = await bcrypt.compare(requestData.newPassword, accountDetails.hashed_password);
    if (areIdenticalPasswords) {
      res.status(409).json({
        success: false,
        message: `New password can't be identical to current password.`,
        reason: 'identicalPasswords'
      });

      return;
    };

    if (accountDetails.username === requestData.newPassword) {
      res.status(409).json({ success: false, message: `New password can't be identical to username.`, reason: 'passwordEqualsUsername' });
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
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    await purgeAuthSessions(authSessionDetails.user_id, 'account');
    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: authSessionDetails.user_id,
      user_type: 'account',
      keepSignedIn: false,
    });

    res.json({ success: true, resData: { authSessionCreated } });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.post('/details/updateEmail/start', async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
    newEmail: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['password', 'newEmail'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmail(requestData.newEmail)) {
    res.status(400).json({ success: false, message: 'Invalid email address.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
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
        session_id = ?`,
      [authSessionId]
    );

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface AccountDetails extends RowDataPacket {
      hashed_password: string,
      email: string,
      display_name: string,
      failed_sign_in_attempts: number,
      update_id: number,
      new_email: string,
      verification_code: string,
      request_timestamp: number,
      update_emails_sent: number,
      failed_update_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.hashed_password,
        accounts.email,
        accounts.display_name,
        accounts.failed_sign_in_attempts,
        email_update.update_id,
        email_update.new_email,
        email_update.verification_code,
        email_update.request_timestamp,
        email_update.update_emails_sent,
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

    const accountDetails: AccountDetails = accountRows[0];

    if (accountRows.length === 0) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    if (requestData.newEmail === accountDetails.email) {
      res.status(409).json({ success: false, message: `New email can't be identical to current email.` });
      return;
    };

    if (!accountDetails.update_id) {
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
        res.status(409).json({ success: false, message: 'Email is already taken.' });

        return;
      };

      const newVerificationCode: string = generateUniqueCode();
      await connection.execute(
        `INSERT INTO email_update(
          account_id,
          new_email,
          verification_code,
          request_timestamp,
          update_emails_sent,
          failed_update_attempts
        )
        VALUES(${generatePlaceHolders(6)});`,
        [authSessionDetails.user_id, requestData.newEmail, newVerificationCode, Date.now(), 1, 0]
      );

      await connection.commit();
      res.json({ success: true, resData: {} });

      await sendEmailUpdateEmail({
        to: requestData.newEmail,
        verificationCode: newVerificationCode,
        displayName: accountDetails.display_name,
      });

      return;
    };

    if (accountDetails.failed_update_attempts >= 3) {
      const { hoursRemaining, minutesRemaining } = userUtils.getTimeTillNextRequest(accountDetails.request_timestamp, 'day');
      res.status(403).json({
        success: false,
        message: 'Too many failed attempts.',
        resData: {
          hoursRemaining,
          minutesRemaining: minutesRemaining || 1,
        },
      });

      return;
    };

    if (requestData.newEmail !== accountDetails.new_email) {
      res.status(409).json({ success: false, message: 'Ongoing request contains a different new email address.' });
      return;
    };

    if (accountDetails.update_emails_sent >= 3) {
      res.status(403).json({ success: false, message: 'Update email limit reached.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        email_update
      SET
        update_emails_sent = update_emails_sent + 1
      WHERE
        update_id = ?;`,
      [accountDetails.update_id]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

    await sendEmailUpdateEmail({
      to: requestData.newEmail,
      verificationCode: accountDetails.verification_code,
      displayName: accountDetails.display_name,
    });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

accountsRouter.patch('/details/updateEmail/confirm', async (req: Request, res: Response) => {
  interface RequestData {
    verificationCode: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['verificationCode'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidCode(requestData.verificationCode)) {
    res.status(400).json({ success: false, message: 'Invalid verification code.' });
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
        sessions_id = ?;`,
      [authSessionId]
    );

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface AccountDetails extends RowDataPacket {
      display_name: string,
      email: string,
      update_id: number,
      new_email: string,
      verification_code: string,
      request_timestamp: number,
      failed_update_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.display_name,
        accounts.email,
        email_update.update_id,
        email_update.new_email,
        email_update.verification_code,
        email_update.request_timestamp,
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

    if (accountRows.length === 0) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (!accountDetails.update_id) {
      res.status(404).json({ success: false, message: 'Email update request not found.' });
      return;
    };

    if (accountDetails.failed_update_attempts >= 3) {
      const { hoursRemaining, minutesRemaining } = userUtils.getTimeTillNextRequest(accountDetails.request_timestamp, 'day');
      res.status(403).json({
        success: false,
        message: 'Too many failed attempts.',
        resData: {
          hoursRemaining,
          minutesRemaining: minutesRemaining || 1,
        },
      });

      return;
    };

    if (requestData.verificationCode !== accountDetails.verification_code) {
      const requestSuspended: boolean = accountDetails.failed_update_attempts + 1 >= 3;

      const resetRequestTimestamp: string = requestSuspended ? `, request_timestamp = ${Date.now()}` : '';
      await dbPool.execute(
        `UPDATE
            email_update
          SET
            failed_update_attempts = failed_update_attempts + 1
            ${resetRequestTimestamp}
          WHERE
            update_id = ?;`,
        [Date.now(), accountDetails.update_id]
      );

      if (requestSuspended) {
        await purgeAuthSessions(authSessionDetails.user_id, 'account');
        removeRequestCookie(res, 'authSessionId', true);
      };

      res.status(401).json({
        success: false,
        message: `Incorrect verification code.${requestSuspended ? 'Request suspended.' : ''}`,
        reason: requestSuspended ? 'requestSuspended' : undefined,
      });

      if (requestSuspended) {
        await sendEmailUpdateWarningEmail(accountDetails.email, accountDetails.display_name);
      };

      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        email = ?
      WHERE
        account_id = ?;`,
      [accountDetails.new_email, authSessionDetails.user_id]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    await purgeAuthSessions(authSessionDetails.user_id, 'account');
    const authSessionCreated: boolean = await createAuthSession(res, {
      user_id: authSessionDetails.user_id,
      user_type: 'account',
      keepSignedIn: false,
    });

    res.json({ success: true, resData: { authSessionCreated } });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.patch('/details/updateDisplayName', async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
    newDisplayName: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['password', 'newDisplayName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  let connection;

  if (!userValidation.isValidDisplayName(requestData.newDisplayName)) {
    res.status(400).json({ success: false, message: 'Invalid display name.' });
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
        session_id = ?:`,
      [authSessionId]
    );

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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

    if (accountRows.length === 0) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      await handleIncorrectAccountPassword(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
      return;
    };

    if (requestData.newDisplayName === accountDetails.display_name) {
      res.status(409).json({ success: false, message: `New display name can't be identical to current display name` });
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
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.execute(
      `UPDATE
        hangout_members
      SET
        display_name = ?
      WHERE
        account_id = ?;`,
      [requestData.newDisplayName]
    );

    await connection.commit();
    res.json({ success: true, resData: { newDisplayName: requestData.newDisplayName } });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    res.status(500).json({ success: false, message: 'Internal server error.' });

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
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['requesteeUsername'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidUsername(requestData.requesteeUsername)) {
    res.status(400).json({ success: false, message: 'Invalid requestee username.' });
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

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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

    if (requesteeRows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    };

    const requesteeId: number = requesteeRows[0].requestee_id;

    if (requesteeId === authSessionDetails.user_id) {
      res.status(409).json({ success: false, message: 'Can not add yourself as a friend.' });
      return;
    };

    interface alreadyFriends extends RowDataPacket { already_friends: 1 | null };
    interface requestAlreadySent extends RowDataPacket { request_already_sent: 1 | null };

    type FriendshipDetails = [
      alreadyFriends[],
      requestAlreadySent[],
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

    const alreadyFriends: boolean = friendshipRows[0][0].already_friends === 1;
    const requestAlreadySent: boolean = friendshipRows[1][0].request_already_sent === 1;

    if (alreadyFriends) {
      res.status(409).json({ success: false, message: 'Already friends.' });
      return;
    };

    if (requestAlreadySent) {
      res.status(409).json({ success: false, message: 'Friend request already sent.' });
      return;
    };

    await dbPool.execute(
      `INSERT INTO friend_requests(
        requester_id,
        requestee_id,
        request_timestamp
      )
      VALUES(${generatePlaceHolders(3)});`,
      [authSessionDetails.user_id, requesteeId, Date.now()]
    );

    res.json({ success: true, resData: {} });
    return;

  } catch (err: unknown) {
    console.log(err);

    if (!isSqlError(err)) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    if (err.errno === 1062) {
      res.status(409).json({ success: false, message: 'Friend request already sent.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.post('/friends/requests/accept', async (req: Request, res: Response) => {
  interface RequestData {
    friendRequestId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['friendRequestId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendRequestId)) {
    res.status(400).json({ success: false, message: 'Invalid friend request ID.' });
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

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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

    if (friendRequestRows.length === 0) {
      res.status(404).json({ success: false, message: 'Friend request not found.' });
      return;
    };

    const requesterId: number = friendRequestRows[0].requester_id;
    const friendshipTimestamp: number = Date.now();

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO friendships(
        first_account_id,
        second_account_id,
        friendship_timestamp
      )
      VALUES(${generatePlaceHolders(3)});`,
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
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: {} });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (!isSqlError(err)) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    const sqlError: SqlError = err;

    if (sqlError.errno === 1062) {
      res.status(409).json({ success: false, message: 'Already friends.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

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
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['friendRequestId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendRequestId)) {
    res.status(400).json({ success: false, message: 'Invalid friend request ID.' });
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

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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
      res.status(404).json({ success: false, message: 'Friend request not found.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.delete('/friends/manage/remove', async (req: Request, res: Response) => {
  interface RequestData {
    friendshipId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['friendshipId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendshipId)) {
    res.status(400).json({ success: false, message: 'Invalid friendship ID.' });
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

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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

    if (friendshipRows.length === 0) {
      res.status(404).json({ success: false, message: 'Friend not found.' });
      return;
    };

    const friendId: number = friendshipRows[0].friend_id;
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
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});