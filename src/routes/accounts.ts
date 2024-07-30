import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import bcrypt from 'bcrypt';
import * as userValidation from '../util/validation/userValidation';
import * as tokenGenerator from '../util/tokenGenerator';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { sendDeletionEmail, sendEmailUpdateEmail, sendRecoveryEmail, sendVerificationEmail } from '../util/email/emailServices';
import { generatePlaceHolders } from '../util/generatePlaceHolders';

export const accountsRouter: Router = express.Router();

interface CreateAccountData {
  email: string,
  hashedPassword: string,
  username: string,
  displayName: string,
};

async function createAccount(res: Response, createAccountData: CreateAccountData, attemptNumber: number = 1): Promise<void> {
  const { email, hashedPassword, displayName, username } = createAccountData;

  const authToken: string = tokenGenerator.generateAuthToken('account');
  const verificationCode: string = tokenGenerator.generateUniqueCode();

  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return;
  };

  let connection;

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        new_email
      FROM
        EmailUpdateRequests
      WHERE
        new_email = ?;`,
      [createAccountData.email]
    );

    if (rows.length !== 0) {
      res.status(409).json({ success: false, message: 'Email address already in use.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const [insertData]: any = await connection.execute(
      `INSERT INTO Accounts(
        auth_token,
        email,
        hashed_password,
        username,
        display_name,
        created_on_timestamp,
        is_verified,
        failed_sign_in_attempts,
        marked_for_deletion
      )
      VALUES(${generatePlaceHolders(9)});`,
      [authToken, email, hashedPassword, username, displayName, Date.now(), false, 0, false]
    );

    const accountID: number = insertData.insertId;
    await connection.execute(
      `INSERT INTO AccountVerification(
        account_id,
        verification_code,
        verification_emails_sent,
        failed_verification_attempts
      )
      VALUES(${generatePlaceHolders(4)});`,
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

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'username'`)) {
      res.status(409).json({ success: false, message: 'Username taken.' });
      return;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await createAccount(res, createAccountData, ++attemptNumber);
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
  };
};

interface UpdatePasswordData {
  accountID: number,
  recoveryID: number | null,
  newHashedPassword: string,
};

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
      `UPDATE
        Accounts
      SET
        auth_token = ?,
        hashed_password = ?,
        failed_sign_in_attempts = 0
      WHERE
        account_id = ?;`,
      [newAuthToken, updatePasswordData.newHashedPassword, updatePasswordData.accountID]
    );

    if (updatePasswordData.recoveryID) {
      await connection.execute(
        `DELETE FROM
          AccountRecovery
        WHERE
          recovery_id = ?;`,
        [updatePasswordData.recoveryID]
      );
    };

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

interface UpdateEmailData {
  accountID: number,
  updateID: number,
  newEmail: string,
};

async function updateEmail(res: Response, emailUpdateData: UpdateEmailData, attemptNumber: number = 1): Promise<void> {
  const newAuthToken: string = tokenGenerator.generateAuthToken('account');

  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return;
  };

  try {
    await dbPool.execute(
      `UPDATE
        Accounts
      SET
        auth_token = ?,
        email = ?
      WHERE
        account_id = ?;`,
      [newAuthToken, emailUpdateData.newEmail, emailUpdateData.accountID]
    );

    await dbPool.execute(
      `DELETE FROM
        EmailUpdateRequests
      WHERE
        update_id = ?;`,
      [emailUpdateData.updateID]
    );

    res.json({ success: true, resData: { newAuthToken } })

  } catch (err: any) {
    console.log(err);

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
      res.status(409).json({ success: false, message: 'Email address already in use.' });
      return;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await updateEmail(res, emailUpdateData, ++attemptNumber);
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  };
};

// --- --- ---

accountsRouter.post('/signUp', async (req: Request, res: Response) => {
  interface RequestData {
    email: string,
    password: string,
    username: string,
    displayName: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['email', 'password', 'username', 'displayName'];
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

  if (!userValidation.isValidUsernameString(requestData.username)) {
    res.status(400).json({ success: false, message: 'Invalid username.' });
    return;
  };

  if (!userValidation.isValidDisplayNameString(requestData.displayName)) {
    res.status(400).json({ success: false, message: 'Invalid display name.' });
    return;
  };

  try {
    const hashedPassword: string = await bcrypt.hash(requestData.password, 10);
    const createAccountData: CreateAccountData = {
      email: requestData.email,
      hashedPassword,
      username: requestData.username,
      displayName: requestData.displayName,
    };

    await createAccount(res, createAccountData);

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

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
      FROM
        Accounts
      LEFT JOIN
        AccountVerification ON Accounts.account_id = AccountVerification.account_id
      WHERE
        Accounts.account_id = ?
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
      `UPDATE
        AccountVerification
      SET
        verification_emails_sent = verification_emails_sent + 1
      WHERE
        account_id = ?;`,
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
      FROM
        Accounts
      LEFT JOIN
        AccountVerification ON Accounts.account_id = AccountVerification.account_id
      WHERE
        Accounts.account_id = ?
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
          `DELETE FROM
            Accounts
          WHERE
            account_id = ?;`,
          [requestData.accountID]
        );

        res.status(401).json({ success: false, message: 'Incorrect verification code. Account deleted.' });
        return;
      };

      await dbPool.execute(
        `UPDATE
          AccountVerification
        SET
          failed_verification_attempts = failed_verification_attempts + 1
        WHERE
          account_id = ?;`,
        [requestData.accountID]
      );

      res.status(401).json({ success: false, message: 'Incorrect verification code.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE
        Accounts
      SET
        is_verified = TRUE
      WHERE
        account_id = ?;`,
      [requestData.accountID]
    );

    await connection.execute(
      `DELETE FROM
        AccountVerification
      WHERE
        account_id = ?;`,
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
    username: string,
    password: string,
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['username', 'password'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidUsernameString(requestData.username)) {
    res.status(400).json({ success: false, message: 'Invalid username.' });
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
      FROM
        Accounts
      WHERE
        username = ?
      LIMIT 1;`,
      [requestData.username]
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
        `UPDATE
          Accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`,
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
        `UPDATE
          Accounts
        SET
          failed_sign_in_attempts = 0
        WHERE
          account_id = ?;`,
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
      FROM
        Accounts
      LEFT JOIN
        AccountRecovery ON Accounts.account_id = AccountRecovery.account_id
      WHERE
        Accounts.email = ?
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
        VALUES(${generatePlaceHolders(4)});`,
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
      `UPDATE
        AccountRecovery
      SET
        recovery_emails_sent = recovery_emails_sent + 1
      WHERE
        recovery_id = ?;`,
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

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        recovery_id,
        recovery_token
      FROM
        AccountRecovery
      WHERE
        account_id = ?;`,
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
      FROM
        Accounts
      WHERE
        auth_token = ?
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
        `UPDATE
          Accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`,
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

    const [hangoutRows]: any = await connection.execute(
      `SELECT
        hangout_id
      FROM
        HangoutMembers
      WHERE
        auth_token = ? AND
        is_leader = TRUE;`,
      [authToken]
    );


    if (hangoutRows.length !== 0) {
      let hangoutIdsToDelete: string = ``;

      for (let i = 0; i < hangoutRows.length; i++) {
        if (i + 1 === hangoutRows.length) {
          hangoutIdsToDelete += `'${hangoutRows[i].hangout_id}'`;
          continue;
        };

        hangoutIdsToDelete += `'${hangoutRows[i].hangout_id}', `;
      };

      console.log(hangoutRows)
      console.log(hangoutIdsToDelete)

      await connection.execute(
        `DELETE FROM
          Hangouts
        WHERE
          hangout_id IN (${hangoutIdsToDelete});`
      );

      await connection.execute(
        `DELETE FROM
          HangoutMembers
        WHERE
          auth_token = ?;`,
        [authToken]
      );
    };

    const markedAuthToken: string = `d_${authToken}`;
    const cancellationToken: string = tokenGenerator.generateUniqueToken();

    await connection.execute(
      `UPDATE
        Accounts
      SET
        auth_token = ?,
        marked_for_deletion = TRUE
      WHERE
        account_id = ?;`,
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
      FROM
        AccountDeletionRequests
      WHERE
        account_id = ?
      LIMIT 1;`,
      [requestData.accountID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Deletion request not found.' });
      return;
    };

    interface DeletionData {
      deletionID: number,
      cancellationToken: string,
    };

    const deletionData: DeletionData = {
      deletionID: rows[0].deletion_id,
      cancellationToken: rows[0].cancellation_token,
    };

    if (requestData.cancellationToken !== deletionData.cancellationToken) {
      res.status(401).json({ success: false, message: 'Incorrect cancellation token.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    connection.execute(
      `UPDATE
        Accounts
      SET
        auth_token = SUBSTRING(auth_token, 3, CHAR_LENGTH(auth_token) - 2),
        marked_for_deletion = FALSE
      WHERE
        account_id = ?;`,
      [requestData.accountID]
    );

    connection.execute(
      `DELETE FROM
        AccountDeletionRequests
      WHERE
        deletion_id = ?;`,
      [deletionData.deletionID]
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
      FROM
        Accounts
      WHERE
        auth_token = ?
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
        `UPDATE
          Accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`,
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
    const updatePasswordData: UpdatePasswordData = {
      accountID: accountDetails.accountID,
      recoveryID: null,
      newHashedPassword,
    };

    await updatePassword(res, updatePasswordData);

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

  let connection;

  try {
    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const [rows]: any = await connection.execute(
      `SELECT
        Accounts.account_id,
        Accounts.hashed_password,
        Accounts.email,
        Accounts.failed_sign_in_attempts,
        EmailUpdateRequests.update_id,
        EmailUpdateRequests.new_email,
        EmailUpdateRequests.verification_code,
        EmailUpdateRequests.update_emails_sent
      FROM
        Accounts
      LEFT JOIN
        EmailUpdateRequests ON Accounts.account_id = EmailUpdateRequests.account_id
      WHERE
        Accounts.auth_token = ?
      LIMIT 1;`,
      [authToken]
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
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
      await connection.execute(
        `UPDATE
          Accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`,
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
      res.status(409).json({ success: false, message: 'New email can not be equal to the current email.' });
      return;
    };

    const [emailRows]: any = await connection.execute(
      `SELECT
        1
      FROM
        Accounts
      WHERE
        email = ?
      UNION
      SELECT
        1
      FROM
        EmailUpdateRequests
      WHERE
        new_email = ?
      LIMIT 1;`,
      [requestData.newEmail, requestData.newEmail]
    );

    if (emailRows.length !== 0) {
      res.status(409).json({ success: false, message: 'Email already in use.' });
      return;
    };

    if (!accountDetails.updateID) { // no update requests
      const newVerificationCode: string = tokenGenerator.generateUniqueCode();
      await connection.execute(
        `INSERT INTO EmailUpdateRequests(
          account_id,
          new_email,
          verification_code,
          request_timestamp,
          update_emails_sent,
          failed_update_attempts
        )
        VALUES(${generatePlaceHolders(6)});`,
        [accountDetails.accountID, requestData.newEmail, newVerificationCode, Date.now(), 1, 0]
      );

      await connection.commit();
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

    await connection.execute(
      `UPDATE
        EmailUpdateRequests
      SET
        update_emails_sent = update_emails_sent + 1
      WHERE
        update_id = ?;`,
      [accountDetails.updateID]
    );

    await connection.commit();
    res.json({ success: true, resData: { accountID: accountDetails.accountID } });

    await sendEmailUpdateEmail(accountDetails.newEmail, accountDetails.accountID, accountDetails.verificationCode);

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (err.errno === 1062) {
      res.status(409).json({ success: false, message: 'Email already in use.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
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
      FROM
        Accounts
      LEFT JOIN
        EmailUpdateRequests ON Accounts.account_id = EmailUpdateRequests.account_id
      WHERE
        Accounts.account_id = ?
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
        `UPDATE
          EmailUpdateRequests
        SET
          failed_update_attempts = failed_update_attempts + 1
        WHERE
          update_id = ?;`,
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

accountsRouter.put('/details/updateDisplayName', async (req: Request, res: Response) => {
  interface RequestData {
    password: string,
    newDisplayName: string,
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

  const expectedKeys: string[] = ['password', 'newDisplayName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  if (!userValidation.isValidDisplayNameString(requestData.newDisplayName)) {
    res.status(400).json({ success: false, message: 'Invalid display name.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        account_id,
        hashed_password,
        failed_sign_in_attempts,
        display_name
      FROM
        Accounts
      WHERE
        auth_token = ?
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
      displayName: string,
    };

    const accountDetails: AccountDetails = {
      accountID: rows[0].account_id,
      hashedPassword: rows[0].hashed_password,
      failedSignInAttempts: rows[0].failed_sign_in_attempts,
      displayName: rows[0].display_name,
    };

    if (accountDetails.failedSignInAttempts === 5) {
      res.status(403).json({ success: false, message: 'Account locked.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashedPassword);
    if (!isCorrectPassword) {
      await dbPool.execute(
        `UPDATE
          Accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`,
        [accountDetails.accountID]
      );

      if (accountDetails.failedSignInAttempts + 1 === 5) {
        res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
        return;
      };

      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    if (requestData.newDisplayName === accountDetails.displayName) {
      res.status(409).json({ success: false, message: 'Account already has this display name.' });
      return;
    };

    await dbPool.execute(
      `UPDATE
        Accounts
      SET
        display_name = ?
      WHERE
        account_id = ?;`,
      [requestData.newDisplayName, accountDetails.accountID]
    );

    res.json({ success: true, resData: { newDisplayName: requestData.newDisplayName } });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.post('/friends/requests/send', async (req: Request, res: Response) => {
  interface RequestData {
    requesteeUsername: string,
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

  const expectedKeys: string[] = ['requesteeUsername'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidUsernameString(requestData.requesteeUsername)) {
    res.status(400).json({ success: false, message: 'Invalid username.' });
    return;
  };

  try {
    const [requesterRows]: any = await dbPool.execute(
      `SELECT
        account_id,
        username
      FROM
        Accounts
      WHERE
        auth_token = ?;`,
      [authToken]
    );

    if (requesterRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const requesterID: number = requesterRows[0].account_id;
    const requesterUsername: string = requesterRows[0].username;

    if (requesterUsername === requestData.requesteeUsername) {
      res.status(409).json({ success: false, message: 'Can not add yourself as a friend.' });
      return;
    };

    const [requesteeRows]: any = await dbPool.execute(
      `SELECT
        account_id
      FROM
        Accounts
      WHERE
        username = ?
      LIMIT 1;`,
      [requestData.requesteeUsername]
    );

    if (requesteeRows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    const requesteeID: number = requesteeRows[0].account_id;
    const [friendshipRows]: any = await dbPool.execute(
      `SELECT
        friendship_id
      FROM
        Friendships
      WHERE
        account_id = ? AND
        friend_id = ?
      LIMIT 1;`,
      [requesterID, requesteeID]
    );

    if (friendshipRows.length > 0) {
      res.status(409).json({ success: false, message: 'Already friends.' });
      return;
    };

    const [friendRequestRows]: any = await dbPool.execute(
      `SELECT
        request_id,
        requester_id,
        requestee_id
      FROM
        FriendRequests
      WHERE
        (requester_id = ? AND requestee_id = ?) OR
        (requester_id = ? AND requestee_id = ?)
      LIMIT 2;`,
      [requesterID, requesteeID, requesteeID, requesterID]
    );

    if (friendRequestRows.length === 0) {
      await dbPool.execute(
        `INSERT INTO FriendRequests(
          requester_id,
          requestee_id,
          request_timestamp
        )
        VALUES(${generatePlaceHolders(3)});`,
        [requesterID, requesteeID, Date.now()]
      );

      res.json({ success: true, resData: {} });
      return;
    };

    let toRequester: boolean = false;
    let toRequestee: boolean = false;

    for (const request of friendRequestRows) {
      if (request.requester_id === requesterID) {
        toRequestee = true;
      };

      if (request.requester_id === requesteeID) {
        toRequester = true;
      };
    };

    if (!toRequester && toRequestee) {
      res.status(409).json({ success: false, message: 'Request already sent.' });
      return;
    };

    const request: any = friendRequestRows.find((request: any) => request.requester_id === requesteeID);
    res.status(409).json({
      success: false,
      message: 'Pending friend request.',
      resData: {
        friendRequestID: request.request_id,
      },
    });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.put('/friends/requests/accept', async (req: Request, res: Response) => {
  interface RequestData {
    friendRequestID: number,
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

  const expectedKeys: string[] = ['friendRequestID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendRequestID)) {
    res.status(400).json({ success: false, message: 'Invalid friend request ID.' });
    return;
  };

  let connection;

  try {
    const [accountRows]: any = await dbPool.execute(
      `SELECT
        account_id
      FROM
        Accounts
      WHERE
        auth_token = ?;`,
      [authToken]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountID: number = accountRows[0].account_id;
    const [friendRequestRows]: any = await dbPool.execute(
      `SELECT
        requester_id
      FROM
        FriendRequests
      WHERE
        request_id = ? AND
        requestee_id = ?;`,
      [requestData.friendRequestID, accountID]
    );

    if (friendRequestRows.length === 0) {
      res.status(404).json({ success: false, message: 'Friend request not found.' });
      return;
    };

    const friendID: string = friendRequestRows[0].requester_id;
    const friendshipTimestamp: number = Date.now();

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    connection.execute(
      `INSERT INTO Friendships(
        account_id,
        friend_id,
        friendship_timestamp
      )
      VALUES
        (${generatePlaceHolders(3)}),
        (${generatePlaceHolders(3)});`,
      [accountID, friendID, friendshipTimestamp, friendID, accountID, friendshipTimestamp]
    );

    connection.execute(
      `DELETE FROM
        FriendRequests
      WHERE
        requester_id = ? AND
        requestee_id = ?;`,
      [friendID, accountID]
    );

    await connection.commit();
    res.json({ success: true, resData: {} })

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (err.errno === 1062) {
      res.status(409).json({ success: false, message: 'Already friends.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    if (connection) {
      connection.release();
    };
  };
});

accountsRouter.delete('/friends/requests/decline', async (req: Request, res: Response) => {
  interface RequestData {
    friendRequestID: number,
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

  const expectedKeys: string[] = ['friendRequestID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendRequestID)) {
    res.status(400).json({ success: false, message: 'Invalid friend request ID.' });
  };

  try {
    const [accountRows]: any = await dbPool.execute(
      `SELECT
        account_id
      FROM
        Accounts
      WHERE
        auth_token = ?;`,
      [authToken]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountID: number = accountRows[0].account_id;
    const [deletionData]: any = await dbPool.execute(
      `DELETE FROM
        FriendRequests
      WHERE
        request_id = ? AND
        requestee_id = ?;`,
      [requestData.friendRequestID, accountID]
    );

    if (deletionData.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Friend request not found.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.delete('/friends/remove', async (req: Request, res: Response) => {
  interface RequestData {
    friendshipID: number,
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

  const expectedKeys: string[] = ['friendRequestID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendshipID)) {
    res.status(400).json({ success: false, message: 'Invalid friendship ID.' });
    return;
  };

  try {
    const [accountRows]: any = await dbPool.execute(
      `SELECT
        account_id
      FROM
        Accounts
      WHERE
        auth_token = ?;`,
      [authToken]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountID: number = accountRows[0].account_id;
    const [friendshipRows]: any = await dbPool.execute(
      `SELECT
        friend_id
      FROM
        Friendships
      WHERE
        friendship_id = ?;`,
      [requestData.friendshipID]
    );

    if (friendshipRows.length === 0) {
      res.status(404).json({ success: false, message: 'Friend not found.' });
      return;
    };

    const friendID: number = friendshipRows[0].friend_id;
    await dbPool.execute(
      `DELETE FROM
        Friendships
      WHERE
        (account_id = ? AND friend_id = ?) OR
        (account_id = ? AND friend_id = ?)
      LIMIT 2;`,
      [accountID, friendID, friendID, accountID]
    );

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});