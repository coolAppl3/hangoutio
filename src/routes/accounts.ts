import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import bcrypt from 'bcrypt';
import * as userValidation from '../util/validation/userValidation';
import { generateAuthToken } from '../util/generators/generateAuthTokens';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { sendDeletionEmail, sendRecoveryEmail, sendVerificationEmail } from '../services/emailServices';
import { generatePlaceHolders } from '../util/generators/generatePlaceHolders';
import { generateVerificationCode } from '../util/generators/generateVerificationCode';
import { generateRecoveryToken } from '../util/generators/generateRecoveryToken';
import { generateCancellationToken } from '../util/generators/generateCancellationToken';

export const accountsRouter: Router = express.Router();


interface AccountCreationData {
  email: string,
  hashedPassword: string,
  userName: string,
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

  if (!userValidation.isValidPasswordString(requestData.password)) {
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

  const authToken: string = generateAuthToken('account');
  const verificationCode: string = generateVerificationCode();

  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return;
  };

  let connection;

  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const [insertData]: any = await connection.execute(
      `INSERT INTO Accounts(
        auth_token,
        email,
        user_name,
        hashed_password,
        created_on_timestamp,
        friends_id_string,
        is_verified,
        failed_sign_in_attempts
      )
      VALUES(${generatePlaceHolders(8)})`,
      [authToken, email, userName, hashedPassword, Date.now(), '', 0, 0]
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

    connection.commit();

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

  if (!userValidation.isValidVerificationCodeString(requestData.verificationCode)) {
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
      SET is_verified = 1
      WHERE account_id = ?;`,
      [requestData.accountID]
    );

    await connection.execute(
      `DELETE FROM AccountVerification
      WHERE account_id = ?;`,
      [requestData.accountID]
    );

    connection.commit();
    res.json({ success: true, resData: { authToken: accountDetails.authToken } });

  } catch (err: any) {
    console.log(err);

    if (connection) {
      connection.rollback();
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
        failed_sign_in_attempts
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
    };

    const accountDetails: AccountDetails = {
      accountID: rows[0].account_id,
      authToken: rows[0].auth_token,
      hashedPassword: rows[0].hashed_password,
      isVerified: rows[0].is_verified,
      failedSignInAttempts: rows[0].failed_sign_in_attempts,
    };

    if (accountDetails.authToken.startsWith('d_')) {
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
        AccountRecovery.request_timestamp
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

    const accountID: number = rows[0].account_id;
    const isVerified: boolean = rows[0].is_verified;
    const recoveryRequestTimestamp: number = rows[0].request_timestamp;

    if (!isVerified) {
      res.status(403).json({ success: false, message: 'Account not verified.' });
      return;
    };

    if (!recoveryRequestTimestamp) {
      const recoveryToken: string = generateRecoveryToken();
      await dbPool.execute(
        `INSERT INTO AccountRecovery(
          account_id,
          recovery_token,
          request_timestamp
        )
        VALUES(${generatePlaceHolders(3)})`,
        [accountID, recoveryToken, Date.now()]
      );

      res.json({ success: true, resData: {} });
      await sendRecoveryEmail(requestData.email, accountID, recoveryToken);

      return;
    };

    const recoveryCooldown: number = 1000 * 60 * 60 * 12; // 12 hours
    if (Date.now() - recoveryRequestTimestamp < recoveryCooldown) {
      res.status(403).json({ success: false, message: 'On recovery cooldown.' });
      return;
    };

    const newRecoveryToken: string = generateRecoveryToken();
    await dbPool.execute(
      `UPDATE AccountRecovery
      SET
        recovery_token = ?,
        request_timestamp = ?,
        failed_recovery_attempts = ?
      WHERE account_id = ?;`,
      [newRecoveryToken, Date.now(), 0, accountID]
    );

    res.json({ success: true, resData: {} })
    await sendRecoveryEmail(requestData.email, accountID, newRecoveryToken);

  } catch (err: any) {
    console.log(err);

    if (err.errno === 1452) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    if (err.errno === 1062) {
      res.status(403).json({ success: false, message: 'On recovery cooldown.' });
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

  if (!userValidation.isValidRecoveryTokenString(requestData.recoveryToken)) {
    res.status(400).json({ success: false, message: 'Invalid recovery token.' });
    return;
  };

  if (!userValidation.isValidPasswordString(requestData.newPassword)) {
    res.status(400).json({ success: false, message: 'Invalid new password.' });
    return;
  };

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
      res.status(404).json({ success: false, message: 'No recovery process found for this account.' });
      return;
    };

    const recoveryID: number = rows[0].recovery_id;
    const recoveryToken: string = rows[0].recovery_token;

    if (requestData.recoveryToken !== recoveryToken) {
      res.status(401).json({ success: false, message: 'Incorrect recovery token.' });
      return;
    };

    const newHashedPassword: string = await bcrypt.hash(requestData.newPassword, 10);

    await dbPool.execute(
      `UPDATE Accounts
      SET hashed_password = ?, failed_sign_in_attempts = 0
      WHERE account_id = ?;`,
      [newHashedPassword, requestData.accountID]
    );

    await dbPool.execute(
      `DELETE FROM AccountRecovery
      WHERE recovery_id = ?;`,
      [recoveryID]
    );

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

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
        hashed_password
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
    };

    const accountDetails: AccountDetails = {
      accountID: rows[0].account_id,
      email: rows[0].email,
      hashedPassword: rows[0].hashed_password,
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashedPassword);
    if (!isCorrectPassword) {
      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const markedAuthToken: string = `d_${authToken}`;
    const cancellationToken: string = generateCancellationToken();

    await connection.execute(
      `UPDATE Accounts
      SET auth_token = ?
      WHERE account_id = ?;`,
      [markedAuthToken, accountDetails.accountID]
    );

    await connection.execute(
      `INSERT INTO AccountDeletionRequests(
        account_id,
        cancellation_token,
        request_timestamp
      )
      VALUES(${generatePlaceHolders(3)})`,
      [accountDetails.accountID, cancellationToken, Date.now()]
    );

    connection.commit();

    res.json({ success: true, resData: {} });
    await sendDeletionEmail(accountDetails.email, accountDetails.accountID, cancellationToken);

  } catch (err: any) {
    console.log(err);

    if (connection) {
      connection.rollback();
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

  if (!userValidation.isValidCancellationTokenString(requestData.cancellationToken)) {
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
      res.status(404).json({ success: false, message: 'Account not found.' });
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
      SET auth_token = SUBSTRING(auth_token, 3, CHAR_LENGTH(auth_token) - 2)
      WHERE account_id = ?;`,
      [requestData.accountID]
    );

    connection.execute(
      `DELETE FROM AccountDeletionRequests
      WHERE deletion_id = ?;`,
      [deletionID]
    );

    connection.commit();
    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);

    if (connection) {
      connection.rollback();
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
  };
});

accountsRouter.put('/details/changePassword', async (req: Request, res: Response) => {
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

  if (!userValidation.isValidPasswordString(requestData.newPassword)) {
    res.status(400).json({ success: false, message: 'Invalid new password.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        account_id,
        hashed_password
      FROM Accounts
      WHERE auth_token = ?
      LIMIT 1;`,
      [authToken]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    const accountID: number = rows[0].account_id;
    const hashedPassword: string = rows[0].hashed_password;

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.currentPassword, hashedPassword);
    if (!isCorrectPassword) {
      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    const newHashedPassword: string = await bcrypt.hash(requestData.newPassword, 10);

    await dbPool.execute(
      `UPDATE Accounts
      SET hashed_password = ?
      WHERE account_id = ?;`,
      [newHashedPassword, accountID]
    );

    res.json({ success: true, resData: {} })

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

    const accountName: string = rows[0].user_name;
    const friendsIdString: string = rows[0].friends_id_string;

    res.json({ success: true, resData: { accountName, friendsIdString } })

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});