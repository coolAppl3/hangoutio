import express, { Router, Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { dbPool } from '../db/db';
import bcrypt from 'bcrypt';
import * as userValidation from '../util/validation/userValidation';
import * as tokenGenerator from '../util/tokenGenerator';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { sendDeletionEmail, sendEmailUpdateEmail, sendEmailUpdateWarningEmail, sendRecoveryEmail, sendVerificationEmail } from '../util/email/emailServices';
import { generatePlaceHolders } from '../util/generatePlaceHolders';
import * as userUtils from '../util/userUtils';

export const accountsRouter: Router = express.Router();

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

  let connection;

  try {
    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    const [emailRows] = await connection.execute<RowDataPacket[]>(
      `(SELECT 1 FROM accounts WHERE email = ? LIMIT 1)
      UNION ALL
      (SELECT 1 FROM email_update WHERE new_email = ? LIMIT 1);`,
      [requestData.email, requestData.email]
    );

    if (emailRows.length > 0) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Email already in use.' });

      return;
    };

    const authToken: string = tokenGenerator.generateAuthToken('account');
    const verificationCode: string = tokenGenerator.generateUniqueCode();
    const hashedPassword: string = await bcrypt.hash(requestData.password, 10);

    const [firstResultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO accounts(
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
      [authToken, requestData.email, hashedPassword, requestData.username, requestData.displayName, Date.now(), false, 0, false]
    );

    const accountID: number = firstResultSetHeader.insertId;
    const idMarkedAuthToken: string = `${authToken}_${accountID}`;

    const [secondResultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        auth_token = ?
      WHERE
        account_id = ?;`,
      [idMarkedAuthToken, accountID]
    );

    if (secondResultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.execute(
      `INSERT INTO account_verification(
        account_id,
        verification_code,
        verification_emails_sent,
        failed_verification_attempts
      )
      VALUES(${generatePlaceHolders(4)});`,
      [accountID, verificationCode, 1, 0]
    );

    await connection.commit();
    res.status(201).json({ success: true, resData: { accountID } });

    await sendVerificationEmail(requestData.email, accountID, verificationCode, requestData.displayName);

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (!err.errno) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      res.status(409).json({ success: false, message: 'Duplicate authToken.' });
      return;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'username'`)) {
      res.status(409).json({ success: false, message: 'Username taken.' });
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    if (connection) {
      connection.release();
    };
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
    interface AccountDetails extends RowDataPacket {
      email: string,
      display_name: string,
      is_verified: boolean,
      verification_id: number,
      verification_code: string,
      verification_emails_sent: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.email,
        accounts.display_name,
        accounts.is_verified,
        account_verification.verification_id,
        account_verification.verification_code,
        account_verification.verification_emails_sent
      FROM
        accounts
      LEFT JOIN
        account_verification ON accounts.account_id = account_verification.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`,
      [requestData.accountID]
    );

    if (accountRows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (accountDetails.is_verified) {
      res.status(400).json({ success: false, message: 'Account already verified.' });
      return;
    };

    if (!accountDetails.verification_id) {
      res.status(404).json({ success: false, message: 'Verification request not found.' });
      return;
    };

    if (accountDetails.verification_emails_sent >= 3) {
      res.status(403).json({ success: false, message: 'Verification emails limit reached.' });
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

    res.json({ success: true, resData: {} });
    await sendVerificationEmail(accountDetails.email, requestData.accountID, accountDetails.verification_code, accountDetails.display_name);

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.patch('/verification/verify', async (req: Request, res: Response) => {
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
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
      is_verified: boolean,
      verification_id: number,
      verification_code: string,
      failed_verification_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.auth_token,
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
      [requestData.accountID]
    );

    if (accountRows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (accountDetails.is_verified) {
      res.status(400).json({ success: false, message: 'Account already verified.' });
      return;
    };

    if (requestData.verificationCode !== accountDetails.verification_code) {
      if (accountDetails.failed_verification_attempts >= 2) {
        await dbPool.execute(
          `DELETE FROM
            accounts
          WHERE
            account_id = ?;`,
          [requestData.accountID]
        );

        res.status(401).json({ success: false, message: 'Incorrect verification code. Account deleted.' });
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

    const [updateHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        is_verified = ?
      WHERE
        account_id = ?;`,
      [true, requestData.accountID]
    );

    if (updateHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    const [deleteHeader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        account_verification
      WHERE
        verification_id = ?;`,
      [accountDetails.verification_id]
    );

    if (deleteHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: { authToken: accountDetails.auth_token } });

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
    res.status(400).json({ success: false, message: 'Invalid request data.', reason: null });
    return;
  };

  if (!userValidation.isValidEmailString(requestData.email)) {
    res.status(400).json({ success: false, message: 'Invalid email address.', reason: 'email' });
    return;
  };

  if (!userValidation.isValidPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid account password.', reason: 'password' });
    return;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      account_id: number,
      auth_token: string,
      hashed_password: string,
      is_verified: boolean,
      failed_sign_in_attempts: number,
      marked_for_deletion: boolean,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        account_id,
        auth_token,
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
      res.status(403).json({ success: false, message: 'Account is locked.' });
      return;
    };

    if (!accountDetails.is_verified) {
      res.status(403).json({ success: false, message: 'Account is not yet unverified.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      if (accountDetails.failed_sign_in_attempts + 1 >= 5) {
        const newAuthToken: string = `${tokenGenerator.generateAuthToken('account')}_${accountDetails.account_id}`;
        await dbPool.execute(
          `UPDATE
            accounts
          SET
            auth_token = ?,
            failed_sign_in_attempts = failed_sign_in_attempts + 1
          WHERE
            account_id = ?;`,
          [newAuthToken, accountDetails.account_id]
        );

        res.status(401).json({ success: false, message: 'Incorrect account password. Account has been locked.' });
        return;
      };

      await dbPool.execute(
        `UPDATE
          accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`,
        [accountDetails.account_id]
      );

      res.status(401).json({ success: false, message: 'Incorrect account password.' });
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

    res.json({ success: true, resData: { authToken: accountDetails.auth_token } });

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
    interface AccountDetails extends RowDataPacket {
      account_id: number,
      display_name: string,
      is_verified: boolean,
      marked_for_deletion: boolean,
      recovery_id: number,
      recovery_token: string,
      recovery_emails_sent: number,
      failed_recovery_attempts: number,
      latest_attempt_timestamp: number | null,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        accounts.account_id,
        accounts.display_name,
        accounts.is_verified,
        accounts.marked_for_deletion,
        account_recovery.recovery_id,
        account_recovery.recovery_token,
        account_recovery.recovery_emails_sent,
        account_recovery.failed_recovery_attempts,
        account_recovery.latest_attempt_timestamp
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
      res.status(403).json({ success: false, message: 'Account unverified.' });
      return;
    };

    if (!accountDetails.recovery_id) {
      const recoveryToken: string = tokenGenerator.generateUniqueToken();
      await dbPool.execute(
        `INSERT INTO account_recovery(
          account_id,
          recovery_token,
          request_timestamp,
          recovery_emails_sent,
          failed_recovery_attempts,
          latest_attempt_timestamp
        )
        VALUES(${generatePlaceHolders(6)});`,
        [accountDetails.account_id, recoveryToken, Date.now(), 1, 0, null]
      );

      res.json({ success: true, resData: {} });
      await sendRecoveryEmail(requestData.email, accountDetails.account_id, recoveryToken, accountDetails.display_name);

      return;
    };

    if (accountDetails.recovery_emails_sent >= 3) {
      res.status(403).json({ success: false, message: 'Recovery email limit reached.' });
      return;
    };

    if (accountDetails.failed_recovery_attempts >= 3 && accountDetails.latest_attempt_timestamp) {
      const { minutesRemaining } = userUtils.getTimeTillNextRequest(accountDetails.latest_attempt_timestamp, 'hour');
      res.status(403).json({
        success: false,
        message: 'Too many failed attempts.',
        resData: {
          minutesRemaining: minutesRemaining || 1,
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

    res.json({ success: true, resData: {} });
    await sendRecoveryEmail(requestData.email, accountDetails.account_id, accountDetails.recovery_token, accountDetails.display_name);

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.patch('/recovery/updatePassword', async (req: Request, res: Response) => {
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
    interface RecoveryDetails extends RowDataPacket {
      recovery_id: number,
      recovery_token: string,
      failed_recovery_attempts: number,
      latest_attempt_timestamp: number | null,
    };

    const [recoveryRows] = await dbPool.execute<RecoveryDetails[]>(
      `SELECT
        recovery_id,
        recovery_token,
        failed_recovery_attempts,
        latest_attempt_timestamp
      FROM
        account_recovery
      WHERE
        account_id = ?
      LIMIT 1;`,
      [requestData.accountID]
    );

    if (recoveryRows.length === 0) {
      res.status(404).json({ success: false, message: 'Recovery request not found.' });
      return;
    };

    const recoveryDetails: RecoveryDetails = recoveryRows[0];

    if (recoveryDetails.failed_recovery_attempts >= 3 && recoveryDetails.latest_attempt_timestamp) {
      const { minutesRemaining } = userUtils.getTimeTillNextRequest(recoveryDetails.latest_attempt_timestamp, 'hour');
      res.status(403).json({
        success: false,
        message: 'Too many failed attempts.',
        resData: {
          minutesRemaining: minutesRemaining || 1,
        },
      });

      return;
    };

    if (requestData.recoveryToken !== recoveryDetails.recovery_token) {
      await dbPool.execute<ResultSetHeader>(
        `UPDATE
          account_recovery
        SET
          failed_recovery_attempts = failed_recovery_attempts + 1,
          latest_attempt_timestamp = ?
        WHERE
          recovery_id = ?;`,
        [Date.now(), recoveryDetails.recovery_id]
      );

      if (recoveryDetails.failed_recovery_attempts + 1 >= 3) {
        res.status(401).json({ success: false, message: 'Incorrect recovery token. Recovery suspended.' });
        return;
      };

      res.status(401).json({ success: false, message: 'Incorrect recovery token.' });
      return;
    };

    const newAuthToken: string = `${tokenGenerator.generateAuthToken('account')}_${requestData.accountID}`;
    const newHashedPassword: string = await bcrypt.hash(requestData.newPassword, 10);

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        auth_token = ?,
        hashed_password = ?,
        failed_sign_in_attempts = ?
      WHERE
        account_id = ?;`,
      [newAuthToken, newHashedPassword, 0, requestData.accountID]
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

    res.json({ success: true, resData: { authToken: newAuthToken } });

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
  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const accountID: number = userUtils.getUserID(authToken);
  const requestData: RequestData = req.body;

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
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
      email: string,
      hashed_password: string,
      display_name: string,
      failed_sign_in_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        auth_token,
        email,
        hashed_password,
        display_name,
        failed_sign_in_attempts
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [accountID]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (authToken !== accountDetails.auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (accountDetails.failed_sign_in_attempts >= 5) {
      res.status(403).json({ success: false, message: 'Account locked.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      if (accountDetails.failed_sign_in_attempts + 1 >= 5) {
        const newAuthToken: string = `${tokenGenerator.generateAuthToken('account')}_${accountID}`;
        await dbPool.execute(
          `UPDATE
            accounts
          SET
            auth_token = ?,
            failed_sign_in_attempts = failed_sign_in_attempts + 1
          WHERE
            account_id = ?;`,
          [newAuthToken, accountID]
        );

        res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
        return;
      };

      await dbPool.execute(
        `UPDATE
          accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`,
        [accountID]
      );

      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION LEVEL ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutDetails extends RowDataPacket {
      hangout_id: string,
      current_step: number,
      hangout_member_id: number,
    };

    const [hangoutRows] = await connection.execute<HangoutDetails[]>(
      `SELECT
        hangouts.hangout_id,
        hangouts.current_step,
        hangout_members.hangout_member_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangout_members.account_id = ?;`,
      [accountID]
    );

    if (hangoutRows.length > 0) {
      const hangoutsInVotingStep: HangoutDetails[] = hangoutRows.filter((hangout: HangoutDetails) => hangout.current_step === 3);

      if (hangoutsInVotingStep.length > 0) {
        const hangoutMemberIDs: number[] = hangoutsInVotingStep.map((hangout: HangoutDetails) => hangout.hangout_member_id);
        const [resultSetHeader] = await connection.execute<ResultSetHeader>(
          `DELETE FROM
            votes
          WHERE
            hangout_member_id IN (${hangoutMemberIDs.join(', ')})
          LIMIT ${hangoutMemberIDs.length};`
        );

        if (resultSetHeader.affectedRows !== hangoutMemberIDs.length) {
          await connection.rollback();
          res.status(500).json({ success: false, message: 'Internal server error.' });

          return;
        };
      };

      const hangoutMemberIDs: number[] = hangoutRows.map((hangout: HangoutDetails) => hangout.hangout_member_id);
      const [resultSetHeader] = await connection.execute<ResultSetHeader>(
        `DELETE FROM
          hangout_members
        WHERE
          hangout_member_id IN (${hangoutMemberIDs.join(', ')})
        LIMIT ${hangoutMemberIDs.length};`
      );

      if (resultSetHeader.affectedRows !== hangoutMemberIDs.length) {
        await connection.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });

        return;
      };
    };

    const markedAuthToken: string = `d_${authToken}`;
    const cancellationToken: string = tokenGenerator.generateUniqueToken();

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        auth_token = ?,
        marked_for_deletion = ?
      WHERE
        account_id = ?;`,
      [markedAuthToken, true, accountID]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.execute(
      `INSERT INTO account_deletion(
        account_id,
        cancellation_token,
        request_timestamp
      )
      VALUES(${generatePlaceHolders(3)});`,
      [accountID, cancellationToken, Date.now()]
    );

    await connection.commit();
    res.status(202).json({ success: true, resData: {} });


    const logDescription: string = `${accountDetails.display_name} has left the hangout.`;
    const currentTimestamp: number = Date.now();

    let logValues: string = '';
    for (const hangout of hangoutRows) {
      logValues += `('${hangout.hangout_id}', '${logDescription})', ${currentTimestamp}),`;
    };
    logValues.slice(0, -1);

    await dbPool.execute(
      `INSERT INTO hangout_logs(
        hangout_id,
        log_description,
        log_timestamp
      )
      VALUES(${logValues});`
    );

    await sendDeletionEmail(accountDetails.email, accountID, cancellationToken, accountDetails.display_name);

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

accountsRouter.patch('/deletion/cancel', async (req: Request, res: Response) => {
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
    interface DeletionDetails extends RowDataPacket {
      deletion_id: number,
      cancellation_token: string,
    };

    const [deletionRows] = await dbPool.execute<DeletionDetails[]>(
      `SELECT
        deletion_id,
        cancellation_token
      FROM
        account_deletion
      WHERE
        account_id = ?
      LIMIT 1;`,
      [requestData.accountID]
    );

    if (deletionRows.length === 0) {
      res.status(404).json({ success: false, message: 'Deletion request not found.' });
      return;
    };

    const deletionDetails: DeletionDetails = deletionRows[0];

    if (requestData.cancellationToken !== deletionDetails.cancellation_token) {
      res.status(401).json({ success: false, message: 'Incorrect cancellation token.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    const newAuthToken: string = `${tokenGenerator.generateAuthToken('account')}_${requestData.accountID}`;
    const [updateHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        auth_token = ?,
        marked_for_deletion = ?
      WHERE
        account_id = ?;`,
      [newAuthToken, false, requestData.accountID]
    );

    if (updateHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    const [deleteHeader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        account_deletion
      WHERE
        deletion_id = ?;`,
      [deletionDetails.deletion_id]
    );

    if (deleteHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

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

accountsRouter.patch('/details/updatePassword', async (req: Request, res: Response) => {
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
  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const accountID: number = userUtils.getUserID(authToken);
  const requestData: RequestData = req.body;

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
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
      hashed_password: string,
      failed_sign_in_attempts: number,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        auth_token,
        hashed_password,
        failed_sign_in_attempts
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [accountID]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (authToken !== accountDetails.auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (accountDetails.failedSignInAttempts >= 5) {
      res.status(403).json({ success: false, message: 'Account locked.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.currentPassword, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      if (accountDetails.failed_sign_in_attempts + 1 >= 5) {
        const newAuthToken: string = `${tokenGenerator.generateAuthToken('account')}_${accountID}`;
        await dbPool.execute(
          `UPDATE
            accounts
          SET
            auth_token = ?,
            failed_sign_in_attempts = failed_sign_in_attempts + 1
          WHERE
            account_id = ?;`,
          [newAuthToken, accountID]
        );

        res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
        return;
      };

      await dbPool.execute(
        `UPDATE
          accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`,
        [accountID]
      );

      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    const isSamePassword: boolean = await bcrypt.compare(requestData.newPassword, accountDetails.hashed_password);
    if (isSamePassword) {
      res.status(409).json({ success: false, message: 'New password matches existing one.' });
      return;
    };

    const newAuthToken: string = `${tokenGenerator.generateAuthToken('account')}_${accountID}`;
    const newHashedPassword: string = await bcrypt.hash(requestData.newPassword, 10);

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        auth_token = ?,
        hashed_password = ?
      WHERE
        account_id = ?;`,
      [newAuthToken, newHashedPassword, accountID]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: { authToken: newAuthToken } });

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
  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const accountID: number = userUtils.getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['password', 'newEmail'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidEmailString(requestData.newEmail)) {
    res.status(400).json({ success: false, message: 'Invalid email address.' });
    return;
  };

  if (!userValidation.isValidPasswordString(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  let connection;

  try {
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
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
        accounts.auth_token,
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
      [accountID]
    );

    const accountDetails: AccountDetails = accountRows[0];

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== accountDetails.auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      if (accountDetails.failed_sign_in_attempts + 1 >= 5) {
        const newAuthToken: string = `${tokenGenerator.generateAuthToken('account')}_${accountID}`;
        await dbPool.execute(
          `UPDATE
            accounts
          SET
            auth_token = ?,
            failed_sign_in_attempts = failed_sign_in_attempts + 1
          WHERE
            account_id = ?;`,
          [newAuthToken, accountID]
        );

        res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
        return;
      };

      await dbPool.execute(
        `UPDATE
          accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`,
        [accountID]
      );

      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    if (requestData.newEmail === accountDetails.email) {
      res.status(409).json({ success: false, message: 'New email can not be equal to the current email.' });
      return;
    };

    if (!accountDetails.update_id) {
      connection = await dbPool.getConnection();
      await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
      await connection.beginTransaction();

      const [emailRows] = await connection.execute<RowDataPacket[]>(
        `(SELECT 1 FROM accounts WHERE email = ? LIMIT 1)
        UNION ALL
        (SELECT 1 FROM email_update WHERE new_email = ? LIMIT 1);`,
        [requestData.newEmail, requestData.newEmail]
      );

      if (emailRows.length > 0) {
        await connection.rollback();
        res.status(409).json({ success: false, message: 'Email already in use.' });

        return;
      };

      const newVerificationCode: string = tokenGenerator.generateUniqueCode();
      await connection.execute<ResultSetHeader>(
        `INSERT INTO email_update(
          account_id,
          new_email,
          verification_code,
          request_timestamp,
          update_emails_sent,
          failed_update_attempts
        )
        VALUES(${generatePlaceHolders(6)});`,
        [accountID, requestData.newEmail, newVerificationCode, Date.now(), 1, 0]
      );

      await connection.commit();
      res.json({ success: true, resData: {} });

      await sendEmailUpdateEmail(requestData.newEmail, newVerificationCode, accountDetails.display_name);
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
    await sendEmailUpdateEmail(accountDetails.new_email, accountDetails.verification_code, accountDetails.display_name);

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

accountsRouter.patch('/details/updateEmail/confirm', async (req: Request, res: Response) => {
  interface RequestData {
    verificationCode: string,
  };

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

  const accountID: number = userUtils.getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['verificationCode'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidCodeString(requestData.verificationCode)) {
    res.status(400).json({ success: false, message: 'Invalid verification code.' });
    return;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
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
        accounts.auth_token,
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
      [accountID]
    );

    if (accountRows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (authToken !== accountDetails.auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

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
      await dbPool.execute(
        `UPDATE
          email_update
        SET
          failed_update_attempts = failed_update_attempts + 1
        WHERE
          update_id = ?;`,
        [accountDetails.update_id]
      );

      if (accountDetails.failed_sign_in_attempts + 1 >= 3) {
        res.status(401).json({ success: false, message: 'Incorrect verification code. Request suspended.' });
        await sendEmailUpdateWarningEmail(accountDetails.email, accountDetails.display_name);

        return;
      };

      res.status(401).json({ success: false, message: 'Incorrect verification code.' });
      return;
    };

    const newAuthToken: string = `${tokenGenerator.generateAuthToken('account')}_${accountID}`;
    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        auth_token = ?,
        email = ?
      WHERE
        account_id = ?;`,
      [newAuthToken, accountDetails.new_email, accountID]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: { authToken: newAuthToken } });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.patch('/details/updateDisplayName', async (req: Request, res: Response) => {
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
  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const accountID: number = userUtils.getUserID(authToken);
  const requestData: RequestData = req.body;

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

  let connection;

  try {
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
      hashed_password: string,
      failed_sign_in_attempts: number,
      display_name: string,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        auth_token,
        hashed_password,
        failed_sign_in_attempts,
        display_name
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [accountID]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (authToken !== accountDetails.auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (accountDetails.failed_sign_in_attempts >= 5) {
      res.status(403).json({ success: false, message: 'Account locked.' });
      return;
    };

    const isCorrectPassword: boolean = await bcrypt.compare(requestData.password, accountDetails.hashed_password);
    if (!isCorrectPassword) {
      if (accountDetails.failed_sign_in_attempts + 1 >= 5) {
        const newAuthToken: string = `${tokenGenerator.generateAuthToken('account')}_${accountID}`;
        await dbPool.execute(
          `UPDATE
            accounts
          SET
            auth_token = ?,
            failed_sign_in_attempts = failed_sign_in_attempts + 1
          WHERE
            account_id = ?;`,
          [newAuthToken, accountID]
        );

        res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
        return;
      };

      await dbPool.execute(
        `UPDATE
          accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`,
        [accountID]
      );

      res.status(401).json({ success: false, message: 'Incorrect password.' });
      return;
    };

    if (requestData.newDisplayName === accountDetails.display_name) {
      res.status(409).json({ success: false, message: 'New display name matches existing one.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        accounts
      SET
        display_name = ?
      WHERE
        account_id = ?;`,
      [requestData.newDisplayName, accountID]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    await dbPool.execute(
      `UPDATE
        hangout_members
      SET
        display_name = ?
      WHERE
        account_id = ?;`,
      [requestData.newDisplayName]
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
  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const accountID: number = userUtils.getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['requesteeUsername'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!userValidation.isValidUsernameString(requestData.requesteeUsername)) {
    res.status(400).json({ success: false, message: 'Invalid requestee username.' });
    return;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
      username: string,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        auth_token,
        username
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [accountID]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountDetails: AccountDetails = accountRows[0];

    if (authToken !== accountDetails.auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (requestData.requesteeUsername === accountDetails.username) {
      res.status(409).json({ success: false, message: 'Can not add yourself as a friend.' });
    };

    interface RequesteeDetails extends RowDataPacket {
      account_id: number,
    };

    const [requesteeRows] = await dbPool.execute<RequesteeDetails[]>(
      `SELECT
        account_id
      FROM
        accounts
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
    const [friendshipRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
        1
      FROM
        friendships
      WHERE
        account_id = ? AND
        friend_id = ?
      LIMIT 1;`,
      [accountID, requesteeID]
    );

    if (friendshipRows.length > 0) {
      res.status(409).json({ success: false, message: 'Already friends.' });
      return;
    };

    interface FriendRequestDetails extends RowDataPacket {
      request_id: number,
      requester_id: number,
      requestee_id: number,
    };

    const [friendRequestRows] = await dbPool.execute<FriendRequestDetails[]>(
      `SELECT
        request_id,
        requester_id,
        requestee_id
      FROM
        friend_requests
      WHERE
        (requester_id = ? AND requestee_id = ?) OR
        (requester_id = ? AND requestee_id = ?)
      LIMIT 2;`,
      [accountID, requesteeID, requesteeID, accountID]
    );

    if (friendRequestRows.length === 0) {
      await dbPool.execute(
        `INSERT INTO friend_requests(
          requester_id,
          requestee_id,
          request_timestamp
        )
        VALUES(${generatePlaceHolders(3)});`,
        [accountID, requesteeID, Date.now()]
      );

      res.json({ success: true, resData: {} });
      return;
    };

    let toRequester: boolean = false;
    let toRequestee: boolean = false;

    for (const request of friendRequestRows) {
      if (request.requester_id === accountID) {
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

    const friendRequest: FriendRequestDetails | undefined = friendRequestRows.find((request: FriendRequestDetails) => request.requester_id === requesteeID);
    if (!friendRequest) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.status(409).json({
      success: false,
      message: 'Pending friend request.',
      resData: {
        friendRequestID: friendRequest.request_id,
      },
    });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

accountsRouter.post('/friends/requests/accept', async (req: Request, res: Response) => {
  interface RequestData {
    friendRequestID: number,
  };

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

  const accountID: number = userUtils.getUserID(authToken);
  const requestData: RequestData = req.body;

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
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        auth_token
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [accountID]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountAuthToken: string = accountRows[0].auth_token;
    if (authToken !== accountAuthToken) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
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
      [requestData.friendRequestID]
    );

    if (friendRequestRows.length === 0) {
      res.status(404).json({ success: false, message: 'Friend request not found.' });
      return;
    };

    const requesterID: number = friendRequestRows[0].requester_id;
    const friendshipTimestamp: number = Date.now();

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO friendships(
        account_id,
        friend_id,
        friendship_timestamp
      )
      VALUES
        (${generatePlaceHolders(3)}),
        (${generatePlaceHolders(3)});`,
      [accountID, requesterID, friendshipTimestamp, requesterID, accountID, friendshipTimestamp]
    );

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        friend_requests
      WHERE
        request_id = ?;`,
      [requestData.friendRequestID]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: {} });

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
  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const accountID: number = userUtils.getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['friendRequestID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendRequestID)) {
    res.status(400).json({ success: false, message: 'Invalid friend request ID.' });
  };

  try {
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        auth_token
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [accountID]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountAuthToken: string = accountRows[0].auth_token;
    if (authToken !== accountAuthToken) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        friend_requests
      WHERE
        request_id = ?;`,
      [requestData.friendRequestID]
    );

    if (resultSetHeader.affectedRows === 0) {
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
  if (!userValidation.isValidAuthTokenString(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const accountID: number = userUtils.getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['friendshipID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.friendshipID)) {
    res.status(400).json({ success: false, message: 'Invalid friendship ID.' });
    return;
  };

  try {
    interface AccountDetails extends RowDataPacket {
      auth_token: string,
    };

    const [accountRows] = await dbPool.execute<AccountDetails[]>(
      `SELECT
        auth_token
      FROM
        accounts
      WHERE
        account_id = ?;`,
      [accountID]
    );

    if (accountRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const accountAuthToken: string = accountRows[0].auth_token;
    if (authToken !== accountAuthToken) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
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
      [requestData.friendshipID]
    );

    if (friendshipRows.length === 0) {
      res.status(404).json({ success: false, message: 'Friend not found.' });
      return;
    };

    const friendID: number = friendshipRows[0].friend_id;
    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        friendships
      WHERE
        (account_id = ? AND friend_id = ?) OR
        (account_id = ? AND friend_id = ?)
      LIMIT 2;`,
      [accountID, friendID, friendID, accountID]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'Friend not found.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});