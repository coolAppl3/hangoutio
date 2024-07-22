import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import bcrypt from 'bcrypt';
import * as userValidation from '../util/validation/userValidation';
import * as tokenGenerator from '../util/tokenGenerator';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { sendDeletionEmail, sendEmailUpdateEmail, sendRecoveryEmail, sendVerificationEmail } from '../util/email/emailServices';
import { generatePlaceHolders } from '../util/generatePlaceHolders';

export const accountsRouter: Router = express.Router();

interface AccountCreationData {
  email: string,
  hashedPassword: string,
  userName: string,
};

interface UpdateEmailData {
  accountID: number,
  updateID: number,
  newEmail: string,
};

interface UpdatePasswordData {
  accountID: number,
  recoveryID: number,
  newHashedPassword: string,
};

accountsRouter.post('/signUp', async (req: Request, res: Response) => {
  interface RequestData {
    email: string,
    password: string,
    userName: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['email', 'password', 'userName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmailString(requestData.email)) {
    res.status(400).json({ success: false, message: 'Invalid email address.' });
    return;
  };

  if (!userValidation.isValidNewPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  if (!userValidation.isValidNameString(requestData.userName)) {
    res.status(400).json({ success: false, message: 'Invalid account name.' });
    return;
  };

  try {
    const hashedPassword: string = await bcrypt.hash(requestData.password, 10);
    const accountCreationData: AccountCreationData = {
      email: requestData.email,
      hashedPassword,
      userName: requestData.userName,
    };

    await createAccount(res, accountCreationData);

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

async function createAccount(res: Response, accountCreationData: AccountCreationData, attemptNumber: number = 1): Promise<void> {
  const { email, hashedPassword, userName } = accountCreationData;

  const authToken: string = tokenGenerator.generateAuthToken('account');
  const verificationCode: string = tokenGenerator.generateUniqueCode();

  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return;
  };

  let connection;

  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const [rows]: any = await connection.execute(
      `SELECT new_email from EmailUpdateRequests
      WHERE new_email = ?`,
      [accountCreationData.email]
    );

    if (rows.length !== 0) {
      res.status(409).json({ success: false, message: 'Email address already in use.' });
      return;
    };

    const [insertData]: any = await connection.execute(
      `INSERT INTO Accounts(
        auth_token,
        email,
        user_name,
        hashed_password,
        created_on_timestamp,
        friends_id_string,
        is_verified,
        failed_sign_in_attempts,
        marked_for_deletion
      )
      VALUES(${generatePlaceHolders(9)})`,
      [authToken, email, userName, hashedPassword, Date.now(), '', false, 0, false]
    );

    const accountID: number = insertData.insertId;
    await connection.execute(
      `INSERT INTO AccountVerification(
        account_id,
        verification_code,
        verification_emails_sent,
        failed_verification_attempts
      )
      VALUES(${generatePlaceHolders(4)})`,
      [accountID, verificationCode, 1, 0]
    );

    await connection.commit();
    res.json({ success: true, resData: { accountID } });

    await sendVerificationEmail(email, accountID, verificationCode);

  } catch (err: any) {
    console.log(err)

    if (connection) {
      await connection.rollback();
    };

    if (!err.errno) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
      res.status(409).json({ success: false, message: 'Email address already in use.' });
      return;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await createAccount(res, accountCreationData, ++attemptNumber);
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
  };
};

accountsRouter.post('/verification/resendEmail', async (req: Request, res: Response) => {
  interface RequestData {
    accountID: number,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['accountID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountID)) {
    res.status(400).json({ success: false, message: 'Invalid account ID.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Accounts.is_verified,
        Accounts.email,
        AccountVerification.verification_code,
        AccountVerification.verification_emails_sent
      FROM Accounts
      LEFT JOIN AccountVerification ON Accounts.account_id = AccountVerification.account_id
      WHERE Accounts.account_id = ?
      LIMIT 1;`,
      [requestData.accountID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      isVerified: boolean,
      email: string,
      verificationCode: string,
      verificationEmailsSent: number,
    };

    const accountDetails: AccountDetails = {
      isVerified: rows[0].is_verified,
      email: rows[0].email,
      verificationCode: rows[0].verification_code,
      verificationEmailsSent: rows[0].verification_emails_sent,
    };

    if (accountDetails.isVerified) {
      res.status(400).json({ success: false, message: 'Account already verified.' });
      return;
    };

    if (accountDetails.verificationEmailsSent === 3) {
      res.status(403).json({ success: false, message: 'Verification emails limit reached.' });
      return;
    };

    await dbPool.execute(
      `UPDATE AccountVerification
        SET verification_emails_sent = verification_emails_sent + 1
      WHERE account_id = ?;`,
      [requestData.accountID]
    );

    res.json({ success: true, resData: {} });
    await sendVerificationEmail(accountDetails.email, requestData.accountID, accountDetails.verificationCode);

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.post('/verification/verify', async (req: Request, res: Response) => {
  interface RequestData {
    accountID: number,
    verificationCode: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['accountID', 'verificationCode'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountID)) {
    res.status(400).json({ success: false, message: 'Invalid account ID.' });
    return;
  };

  if (!userValidation.isValidCodeString(requestData.verificationCode)) {
    res.status(400).json({ success: false, message: 'Invalid verification code.' });
    return;
  };

  let connection;

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Accounts.auth_token,
        Accounts.is_verified,
        AccountVerification.verification_code,
        failed_verification_attempts
      FROM Accounts
      LEFT JOIN AccountVerification ON Accounts.account_id = AccountVerification.account_id
      WHERE Accounts.account_id = ?
      LIMIT 1;`,
      [requestData.accountID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      authToken: string,
      isVerified: boolean,
      verificationCode: string,
      failedVerificationAttempts: number,
    };

    const accountDetails: AccountDetails = {
      authToken: rows[0].auth_token,
      isVerified: rows[0].is_verified,
      verificationCode: rows[0].verification_code,
      failedVerificationAttempts: rows[0].failed_verification_attempts,
    };

    if (accountDetails.isVerified) {
      res.status(400).json({ success: false, message: 'Account already verified.' });
      return;
    };

    if (requestData.verificationCode !== accountDetails.verificationCode) {
      if (accountDetails.failedVerificationAttempts === 2) {
        await dbPool.execute(
          `DELETE FROM Accounts
          WHERE account_id = ?;`,
          [requestData.accountID]
        );

        res.status(401).json({ success: false, message: 'Incorrect verification code. Account deleted.' });
        return;
      };

      await dbPool.execute(
        `UPDATE AccountVerification
          SET failed_verification_attempts = failed_verification_attempts + 1
        WHERE account_id = ?;`,
        [requestData.accountID]
      );

      res.status(401).json({ success: false, message: 'Incorrect verification code.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE Accounts
        SET is_verified = TRUE
      WHERE account_id = ?;`,
      [requestData.accountID]
    );

    await connection.execute(
      `DELETE FROM AccountVerification
      WHERE account_id = ?;`,
      [requestData.accountID]
    );

    await connection.commit();
    res.json({ success: true, resData: { authToken: accountDetails.authToken } });

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
  };
});

accountsRouter.post('/signIn', async (req: Request, res: Response) => {
  interface RequestData {
    email: string,
    password: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['email', 'password'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmailString(requestData.email)) {
    res.status(400).json({ success: false, message: 'Invalid email address.' });
    return;
  };

  if (!userValidation.isValidPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        account_id,
        auth_token,
        hashed_password,
        is_verified,
        failed_sign_in_attempts,
        marked_for_deletion
      FROM Accounts
      WHERE email = ?
      LIMIT 1;`,
      [requestData.email]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      accountID: number,
      authToken: string,
      hashedPassword: string,
      isVerified: boolean,
      failedSignInAttempts: number,
      markedForDeletion: boolean,
    };

    const accountDetails: AccountDetails = {
      accountID: rows[0].account_id,
      authToken: rows[0].auth_token,
      hashedPassword: rows[0].hashed_password,
      isVerified: rows[0].is_verified,
      failedSignInAttempts: rows[0].failed_sign_in_attempts,
      markedForDeletion: rows[0].marked_for_deletion,
    };

    if (accountDetails.markedForDeletion) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    if (accountDetails.failedSignInAttempts === 5) {
      res.status(403).json({ success: false, message: 'Account locked.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashedPassword);
    if (!isCorrectPassword) {
      await dbPool.execute(
        `UPDATE Accounts
          SET failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE account_id = ?;`,
        [accountDetails.accountID]
      );

      if (accountDetails.failedSignInAttempts + 1 === 5) {
        res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
        return;
      };

      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    if (!accountDetails.isVerified) {
      res.status(403).json({ success: false, message: 'Account not verified.' });
      return;
    };

    if (accountDetails.failedSignInAttempts > 0) {
      await dbPool.execute(
        `UPDATE Accounts
          SET failed_sign_in_attempts = 0
        WHERE account_id = ?;`,
        [accountDetails.accountID]
      );
    };

    res.json({ success: true, resData: { authToken: accountDetails.authToken } });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.post('/recovery/start', async (req: Request, res: Response) => {
  interface RequestData {
    email: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['email'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmailString(requestData.email)) {
    res.status(400).json({ success: false, message: 'Invalid email address.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Accounts.account_id,
        Accounts.is_verified,
        Accounts.marked_for_deletion,
        AccountRecovery.recovery_id,
        AccountRecovery.recovery_emails_sent,
        AccountRecovery.recovery_token
      FROM Accounts
      LEFT JOIN AccountRecovery ON Accounts.account_id = AccountRecovery.account_id
      WHERE Accounts.email = ?
      LIMIT 1;`,
      [requestData.email]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      accountID: number,
      isVerified: boolean,
      markedForDeletion: boolean,
      recoveryID: number,
      recoveryEmailsSent: number,
      recoveryToken: string,
    };

    const accountDetails: AccountDetails = {
      accountID: rows[0].account_id,
      isVerified: rows[0].is_verified,
      markedForDeletion: rows[0].markedForDeletion,
      recoveryID: rows[0].recovery_id,
      recoveryEmailsSent: rows[0].recovery_emails_sent,
      recoveryToken: rows[0].recovery_token,
    };

    if (accountDetails.markedForDeletion) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    if (!accountDetails.isVerified) {
      res.status(403).json({ success: false, message: 'Account not verified.' });
      return;
    };

    if (!accountDetails.recoveryID) { // no recovery process
      const newRecoveryToken: string = tokenGenerator.generateUniqueToken();
      await dbPool.execute(
        `INSERT INTO AccountRecovery(
          account_id,
          recovery_token,
          request_timestamp,
          recovery_emails_sent
        )
        VALUES(${generatePlaceHolders(4)})`,
        [accountDetails.accountID, newRecoveryToken, Date.now(), 1]
      );

      res.json({ success: true, resData: {} });
      await sendRecoveryEmail(requestData.email, accountDetails.accountID, newRecoveryToken);

      return;
    };

    if (accountDetails.recoveryEmailsSent === 3) {
      res.status(403).json({ success: false, message: 'Recovery email limit reached.' });
      return;
    };

    await dbPool.execute(
      `UPDATE AccountRecovery
        SET recovery_emails_sent = recovery_emails_sent + 1
      WHERE account_id = ?;`,
      [accountDetails.recoveryID]
    );

    res.json({ success: true, resData: {} })
    await sendRecoveryEmail(requestData.email, accountDetails.accountID, accountDetails.recoveryToken);

  } catch (err: any) {
    console.log(err);

    if (err.errno === 1452) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.put('/recovery/updatePassword', async (req: Request, res: Response) => {
  interface RequestData {
    accountID: number,
    recoveryToken: string,
    newPassword: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['accountID', 'recoveryToken', 'newPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountID)) {
    res.status(400).json({ success: false, message: 'Invalid account ID.' });
    return;
  };

  if (!userValidation.isValidToken(requestData.recoveryToken)) {
    res.status(400).json({ success: false, message: 'Invalid recovery token.' });
    return;
  };

  if (!userValidation.isValidNewPasswordString(requestData.newPassword)) {
    res.status(400).json({ success: false, message: 'Invalid new password.' });
    return;
  };

  let connection;

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        recovery_id,
        recovery_token
      FROM AccountRecovery
      WHERE account_id = ?;`,
      [requestData.accountID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Recovery request not found.' });
      return;
    };

    interface AccountDetails {
      recoveryID: number,
      recoveryToken: string,
    };

    const accountDetails: AccountDetails = {
      recoveryID: rows[0].recovery_id,
      recoveryToken: rows[0].recovery_token,
    };

    if (requestData.recoveryToken !== accountDetails.recoveryToken) {
      res.status(401).json({ success: false, message: 'Incorrect recovery token.' });
      return;
    };

    const newHashedPassword: string = await bcrypt.hash(requestData.newPassword, 10);
    const updatePasswordData: UpdatePasswordData = {
      accountID: requestData.accountID,
      recoveryID: accountDetails.recoveryID,
      newHashedPassword,
    };

    await updatePassword(res, updatePasswordData);

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

async function updatePassword(res: Response, updatePasswordData: UpdatePasswordData, attemptNumber: number = 1): Promise<void> {
  const newAuthToken: string = tokenGenerator.generateAuthToken('account');
  let connection

  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return;
  };

  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE Accounts
        SET
        auth_token = ?,
        hashed_password = ?,
        failed_sign_in_attempts = 0
      WHERE account_id = ?;`,
      [newAuthToken, updatePasswordData.newHashedPassword, updatePasswordData.accountID]
    );

    await connection.execute(
      `DELETE FROM AccountRecovery
      WHERE recovery_id = ?;`,
      [updatePasswordData.recoveryID]
    );

    await connection.commit();
    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await updatePassword(res, updatePasswordData, ++attemptNumber);
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
  };
};

accountsRouter.delete(`/deletion/start`, async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  const requestData: RequestData = req.body;

  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const expectedKeys: string[] = ['password'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  let connection;

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        account_id,
        email,
        hashed_password,
        failed_sign_in_attempts
      FROM Accounts
      WHERE auth_token = ?
      LIMIT 1;`,
      [authToken]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      accountID: number,
      email: string,
      hashedPassword: string,
      failedSignInAttempts: number,
    };

    const accountDetails: AccountDetails = {
      accountID: rows[0].account_id,
      email: rows[0].email,
      hashedPassword: rows[0].hashed_password,
      failedSignInAttempts: rows[0].failed_sign_in_attempts
    };

    if (accountDetails.failedSignInAttempts === 5) {
      res.status(403).json({ success: false, message: 'Account locked.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashedPassword);
    if (!isCorrectPassword) {
      await dbPool.execute(
        `UPDATE Accounts
          SET failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE account_id = ?;`,
        [accountDetails.accountID]
      );

      if (accountDetails.failedSignInAttempts + 1 === 5) {
        res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
        return;
      };

      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const markedAuthToken: string = `d_${authToken}`;
    const cancellationToken: string = tokenGenerator.generateUniqueToken();

    await connection.execute(
      `UPDATE Accounts
        SET
        auth_token = ?,
        marked_for_deletion = TRUE
      WHERE account_id = ?;`,
      [markedAuthToken, accountDetails.accountID]
    );

    await connection.execute(
      `INSERT INTO AccountDeletionRequests(
        account_id,
        cancellation_token,
        request_timestamp
      )
      VALUES(${generatePlaceHolders(3)});`,
      [accountDetails.accountID, cancellationToken, Date.now()]
    );

    await connection.commit();
    res.status(202).json({ success: true, resData: {} });

    await sendDeletionEmail(accountDetails.email, accountDetails.accountID, cancellationToken);

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (err.errno === 1452) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
  };
});

accountsRouter.put('/deletion/cancel', async (req: Request, res: Response) => {
  interface RequestData {
    accountID: number,
    cancellationToken: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['cancellationToken', 'accountID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountID)) {
    res.status(400).json({ succesS: false, message: 'Invalid account ID.' });
    return;
  };

  if (!userValidation.isValidToken(requestData.cancellationToken)) {
    res.status(400).json({ success: false, message: 'Invalid cancellation token.' });
    return;
  };

  let connection;

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        deletion_id,
        cancellation_token
      FROM AccountDeletionRequests
      WHERE account_id = ?
      LIMIT 1;`,
      [requestData.accountID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Deletion request not found.' });
      return;
    };

    const deletionID: number = rows[0].deletion_id;
    const fetchedCancellationToken: string = rows[0].cancellation_token;

    if (requestData.cancellationToken !== fetchedCancellationToken) {
      res.status(401).json({ success: false, message: 'Incorrect cancellation token.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    connection.execute(
      `UPDATE Accounts
        SET
        auth_token = SUBSTRING(auth_token, 3, CHAR_LENGTH(auth_token) - 2),
        marked_for_deletion = FALSE
      WHERE account_id = ?;`,
      [requestData.accountID]
    );

    connection.execute(
      `DELETE FROM AccountDeletionRequests
      WHERE deletion_id = ?;`,
      [deletionID]
    );

    await connection.commit();
    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
  };
});

accountsRouter.put('/details/updatePassword', async (req: Request, res: Response) => {
  interface RequestData {
    currentPassword: string,
    newPassword: string
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  const requestData: RequestData = req.body;

  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const expectedKeys: string[] = ['currentPassword', 'newPassword'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPasswordString(requestData.currentPassword)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  if (!userValidation.isValidNewPasswordString(requestData.newPassword)) {
    res.status(400).json({ success: false, message: 'Invalid new password.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        account_id,
        hashed_password,
        failed_sign_in_attempts
      FROM Accounts
      WHERE auth_token = ?
      LIMIT 1;`,
      [authToken]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      accountID: number,
      hashedPassword: string,
      failedSignInAttempts: number,
    };

    const accountDetails: AccountDetails = {
      accountID: rows[0].account_id,
      hashedPassword: rows[0].hashed_password,
      failedSignInAttempts: rows[0].failed_sign_in_attempts,
    };

    if (accountDetails.failedSignInAttempts === 5) {
      res.status(403).json({ success: false, message: 'Account locked.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.currentPassword, accountDetails.hashedPassword);
    if (!isCorrectPassword) {
      await dbPool.execute(
        `UPDATE Accounts
          SET failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE account_id = ?;`,
        [accountDetails.accountID]
      );

      if (accountDetails.failedSignInAttempts + 1 === 5) {
        res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
        return;
      };

      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    const newHashedPassword: string = await bcrypt.hash(requestData.newPassword, 10);

    await dbPool.execute(
      `UPDATE Accounts
        SET hashed_password = ?
      WHERE account_id = ?;`,
      [newHashedPassword, accountDetails.accountID]
    );

    res.json({ success: true, resData: {} })

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.post('/details/updateEmail/start', async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
    newEmail: string,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  const requestData: RequestData = req.body;

  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const expectedKeys: string[] = ['password', 'newEmail'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmailString(requestData.newEmail)) {
    res.status(400).json({ success: false, message: 'Invalid new email address.' });
    return;
  };

  if (!userValidation.isValidPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Accounts.account_id,
        Accounts.hashed_password,
        Accounts.email,
        Accounts.failed_sign_in_attempts,
        EmailUpdateRequests.update_id,
        EmailUpdateRequests.new_email,
        EmailUpdateRequests.verification_code,
        EmailUpdateRequests.update_emails_sent
      FROM Accounts
      LEFT JOIN EmailUpdateRequests ON Accounts.account_id = EmailUpdateRequests.account_id
      WHERE Accounts.auth_token = ?
      LIMIT 1;`,
      [authToken]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      accountID: number,
      hashedPassword: string,
      currentEmail: string,
      failedSignInAttempts: number,
      updateID: number,
      newEmail: string,
      verificationCode: string,
      updateEmailsSent: number,
    };

    const accountDetails: AccountDetails = {
      accountID: rows[0].account_id,
      hashedPassword: rows[0].hashed_password,
      currentEmail: rows[0].email,
      failedSignInAttempts: rows[0].failed_sign_in_attempts,
      updateID: rows[0].update_id,
      newEmail: rows[0].new_email,
      verificationCode: rows[0].verification_code,
      updateEmailsSent: rows[0].update_emails_sent,
    };

    if (accountDetails.failedSignInAttempts === 5) {
      res.status(403).json({ success: false, message: 'Account locked.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashedPassword);
    if (!isCorrectPassword) {
      await dbPool.execute(
        `UPDATE Accounts
          SET failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE account_id = ?;`,
        [accountDetails.accountID]
      );

      if (accountDetails.failedSignInAttempts + 1 === 5) {
        res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
        return;
      };

      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    if (requestData.newEmail === accountDetails.currentEmail) {
      res.status(403).json({ success: false, message: 'New email can not be equal to the current email.' });
      return;
    };

    if (!accountDetails.updateID) { // no update requests
      const newVerificationCode: string = tokenGenerator.generateUniqueCode();
      await dbPool.execute(
        `INSERT INTO EmailUpdateRequests(
          account_id,
          new_email,
          verification_code,
          request_timestamp,
          update_emails_sent,
          failed_update_attempts
        )
        VALUES(${generatePlaceHolders(6)})`,
        [accountDetails.accountID, requestData.newEmail, newVerificationCode, Date.now(), 1, 0]
      );

      res.json({ success: true, resData: { accountID: accountDetails.accountID } });
      await sendEmailUpdateEmail(requestData.newEmail, accountDetails.accountID, newVerificationCode);

      return;
    };

    if (requestData.newEmail !== accountDetails.newEmail) {
      res.status(403).json({ success: false, message: 'Ongoing request contains a different new email address.' });
      return;
    };

    if (accountDetails.updateEmailsSent === 3) {
      res.status(403).json({ success: false, message: 'Update email limit reached.' });
      return;
    };

    await dbPool.execute(
      `UPDATE EmailUpdateRequests
        SET update_emails_sent = update_emails_sent + 1
      WHERE update_id = ?;`,
      [accountDetails.updateID]
    );

    res.json({ success: true, resData: { accountID: accountDetails.accountID } });
    await sendEmailUpdateEmail(accountDetails.newEmail, accountDetails.accountID, accountDetails.verificationCode);

  } catch (err: any) {
    console.log(err);

    if (err.errno === 1452) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.put('/details/updateEmail/confirm', async (req: Request, res: Response) => {
  interface RequestData {
    accountID: number,
    verificationCode: string,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  const requestData: RequestData = req.body;

  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const expectedKeys: string[] = ['accountID', 'verificationCode'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.accountID)) {
    res.status(400).json({ success: false, message: 'Invalid account ID.' });
    return;
  };

  if (!userValidation.isValidCodeString(requestData.verificationCode)) {
    res.status(400).json({ success: false, message: 'Invalid verification code.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        Accounts.auth_token,
        EmailUpdateRequests.update_id,
        EmailUpdateRequests.new_email,
        EmailUpdateRequests.verification_code,
        EmailUpdateRequests.failed_update_attempts
      FROM Accounts
      LEFT JOIN EmailUpdateRequests ON Accounts.account_id = EmailUpdateRequests.account_id
      WHERE Accounts.account_id = ?
      LIMIT 1;`,
      [requestData.accountID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      authToken: string,
      updateID: number,
      newEmail: string,
      verificationCode: string,
      failedUpdateAttempts: number
    };

    const accountDetails: AccountDetails = {
      authToken: rows[0].auth_token,
      updateID: rows[0].update_id,
      newEmail: rows[0].new_email,
      verificationCode: rows[0].verification_code,
      failedUpdateAttempts: rows[0].failed_update_attempts,
    };

    if (authToken !== accountDetails.authToken) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (!accountDetails.updateID) {
      res.status(404).json({ success: false, message: 'Email update request not found.' });
      return;
    };

    if (accountDetails.failedUpdateAttempts === 3) {
      res.status(403).json({ success: false, message: 'Update attempt limit reached.' });
      return;
    };

    if (requestData.verificationCode !== accountDetails.verificationCode) {
      await dbPool.execute(
        `UPDATE EmailUpdateRequests
          SET failed_update_attempts = failed_update_attempts + 1
        WHERE update_id = ?`,
        [accountDetails.updateID]
      );

      if (accountDetails.failedUpdateAttempts + 1 === 3) {
        res.status(401).json({ success: false, message: 'Incorrect verification code. Request suspended.' });
        return;
      };

      res.status(401).json({ success: false, message: 'Incorrect verification code.' });
      return;
    };

    const updateEmailData: UpdateEmailData = {
      accountID: requestData.accountID,
      updateID: accountDetails.updateID,
      newEmail: accountDetails.newEmail,
    };

    await updateEmail(res, updateEmailData);

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

async function updateEmail(res: Response, emailUpdateData: UpdateEmailData, attemptNumber: number = 1): Promise<void> {
  const newAuthToken: string = tokenGenerator.generateAuthToken('account');
  let connection;

  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return;
  };

  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE Accounts
        SET
        auth_token = ?,
        email = ?
      WHERE account_id = ?;`,
      [newAuthToken, emailUpdateData.newEmail, emailUpdateData.accountID]
    );

    await connection.execute(
      `DELETE FROM EmailUpdateRequests
      WHERE update_id = ?;`,
      [emailUpdateData.updateID]
    );

    connection.commit();
    res.json({ success: true, resData: { newAuthToken } })

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
      res.status(409).json({ success: false, message: 'Email address already in use.' });
      return;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await updateEmail(res, emailUpdateData, ++attemptNumber);
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
  };
};

accountsRouter.put('/details/updateName', async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
    newName: string,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  const requestData: RequestData = req.body;

  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const expectedKeys: string[] = ['password', 'newName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  if (!userValidation.isValidNameString(requestData.newName)) {
    res.status(400).json({ success: false, message: 'Invalid account name.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        account_id,
        hashed_password,
        failed_sign_in_attempts
      FROM Accounts
      WHERE auth_token = ?
      LIMIT 1;`,
      [authToken]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      accountID: number,
      hashedPassword: string,
      failedSignInAttempts: number,
    };

    const accountDetails: AccountDetails = {
      accountID: rows[0].account_id,
      hashedPassword: rows[0].hashed_password,
      failedSignInAttempts: rows[0].failed_sign_in_attempts,
    };

    if (accountDetails.failedSignInAttempts === 5) {
      res.status(403).json({ success: false, message: 'Account locked.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashedPassword);
    if (!isCorrectPassword) {
      await dbPool.execute(
        `UPDATE Accounts
          SET failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE account_id = ?;`,
        [accountDetails.accountID]
      );

      if (accountDetails.failedSignInAttempts + 1 === 5) {
        res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
        return;
      };

      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    await dbPool.execute(
      `UPDATE Accounts
        SET user_name = ?
      WHERE account_id = ?;`,
      [requestData.newName, accountDetails.accountID]
    );

    res.json({ success: true, resData: { newName: requestData.newName } });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.get('/', async (req: Request, res: Response) => {
  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);

  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        user_name,
        friends_id_string
      FROM Accounts
      WHERE auth_token = ?
      LIMIT 1;`,
      [authToken]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      accountName: string,
      friendsIdString: string,
    };

    const accountDetails: AccountDetails = {
      accountName: rows[0].user_name,
      friendsIdString: rows[0].friends_id_string,
    };

    res.json({ success: true, resData: { accountName: accountDetails.accountName, friendsIdString: accountDetails.friendsIdString } })

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});