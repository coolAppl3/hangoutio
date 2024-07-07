import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import { generateAuthToken } from '../util/authTokens';
import { isValidEmail, isValidPassword, isValidName, isValidAuthTokenString, isValidVerificationCode } from '../util/validation/userValidation';
import { compareHashedPassword, getHashedPassword } from '../services/passwordServices';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { sendVerificationEmail } from '../services/emailServices';
import { deleteAccount, incrementFailedSignInAttempts, incrementFailedVerificationAttempts, incrementVerificationEmailCount, verifyAccount } from '../services/accountServices';
import { generatePlaceHolders } from '../util/generatePlaceHolders';
import { generateVerificationCode } from '../util/generateVerificationCode';

export const accountsRouter: Router = express.Router();

interface CreateAccount {
  email: string,
  password: string,
  userName: string,
};

accountsRouter.post('/signUp', async (req: Request, res: Response) => {
  const requestData: CreateAccount = req.body;

  const expectedKeys: string[] = ['email', 'password', 'userName'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidEmail(requestData.email)) {
    res.status(400).json({ success: false, message: 'Invalid email address.' });
    return;
  };

  if (!isValidPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  if (!isValidName(requestData.userName)) {
    res.status(400).json({ success: false, message: 'Invalid account name.' });
    return;
  };

  const hashedPassword: string = await getHashedPassword(res, requestData.password);
  if (hashedPassword === '') {
    return;
  };

  await createAccount(res, requestData, hashedPassword);
});

async function createAccount(res: Response, requestData: CreateAccount, hashedPassword: string, attemptNumber: number = 1): Promise<void> {
  const authToken: string = generateAuthToken('account');
  const verificationCode: string = generateVerificationCode();

  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server errorrrrr.' });
    return;
  };

  try {
    const [insertData]: any = await dbPool.execute(
      `INSERT INTO Accounts(
        auth_token,
        email,
        user_name,
        password_hash,
        created_on_timestamp,
        friends_id_string,
        verification_code,
        is_verified,
        verification_emails_sent,
        failed_verification_attempts,
        failed_signin_attempts,
        recovery_email_timestamp
      )
      VALUES(${generatePlaceHolders(12)});`,
      [authToken, requestData.email, requestData.userName, hashedPassword, Date.now(), '', verificationCode, false, 1, 0, 0, 0]
    );

    const accountID: number = insertData.insertId;

    res.json({ success: true, resData: { accountID } });
    await sendVerificationEmail(requestData.email, accountID, verificationCode);

  } catch (err: any) {
    console.log(err)

    if (!err.errno) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
      res.status(409).json({ success: false, message: 'Email address is already in use.' });
      return;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await createAccount(res, requestData, hashedPassword, ++attemptNumber);
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
};

accountsRouter.post('/resendVerificationCode', async (req: Request, res: Response) => {
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

  let accountEmail: string;
  let verificationCode: string;
  let verificationEmailsSent: number;

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        email,
        verification_code,
        verification_emails_sent
      FROM Accounts
      WHERE account_id = ?
      LIMIT 1;`,
      [requestData.accountID]
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    accountEmail = rows[0].email;
    verificationCode = rows[0].verification_code;

    verificationEmailsSent = rows[0].verification_emails_sent;
    if (verificationEmailsSent === 3) {
      res.status(403).json({ success: false, message: 'Verification emails limit reached.' });
      return;
    };

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return;
  };

  await incrementVerificationEmailCount(requestData.accountID);
  res.json({ success: true, resData: {} });

  await sendVerificationEmail(accountEmail, requestData.accountID, verificationCode);
});

accountsRouter.post('/verifyAccount', async (req: Request, res: Response) => {
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

  if (!isValidVerificationCode(requestData.verificationCode)) {
    res.status(400).json({ success: false, message: 'Invalid verification code.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        auth_token,
        verification_code,
        is_verified,
        failed_verification_attempts
      FROM Accounts
      WHERE account_id = ?;`,
      [requestData.accountID]
    );

    if (rows.length === 0) {
      res.status(404).json({ success: false, message: 'Account not found.' });
      return;
    };

    interface AccountDetails {
      authToken: string,
      verificationCode: string,
      isVerified: boolean,
      failedVerificationAttempts: number,
    };

    const accountDetails: AccountDetails = {
      authToken: rows[0].auth_token,
      verificationCode: rows[0].verification_code,
      isVerified: rows[0].is_verified,
      failedVerificationAttempts: rows[0].failed_verification_attempts,
    };

    if (accountDetails.isVerified) {
      res.status(400).json({ success: false, message: 'Account already verified.' });
      return;
    };

    if (requestData.verificationCode !== accountDetails.verificationCode) {
      if (accountDetails.failedVerificationAttempts === 2) {
        await deleteAccount(requestData.accountID);
        res.status(401).json({ success: false, message: 'Incorrect Verification code. Account deleted.' });

        return;
      };

      await incrementFailedVerificationAttempts(requestData.accountID);
      res.status(401).json({ success: false, message: 'Incorrect verification code.' });
      return;
    };

    const verificationSuccessful: boolean = await verifyAccount(res, requestData.accountID);
    if (!verificationSuccessful) {
      return;
    };

    res.json({ success: true, resData: { authToken: accountDetails.authToken } });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return;
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

  if (!isValidEmail(requestData.email)) {
    res.status(400).json({ success: false, message: 'Invalid email address.' });
    return;
  };

  if (!isValidPassword(requestData.password)) {
    res.status(401).json({ success: false, message: 'Invalid password.' });
    return;
  };

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT
        account_id,
        auth_token,
        password_hash,
        is_verified,
        failed_signin_attempts
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
      passwordHash: string,
      isVerified: boolean,
      failedSigningAttempts: number,
    };

    const accountDetails: AccountDetails = {
      accountID: rows[0].account_id,
      authToken: rows[0].auth_token,
      passwordHash: rows[0].password_hash,
      isVerified: rows[0].is_verified,
      failedSigningAttempts: rows[0].failed_signin_attempts,
    };

    if (accountDetails.failedSigningAttempts === 5) {
      res.status(403).json({ success: false, message: 'Account locked.' });
      return;
    };

    const isCorrectPassword: boolean = await compareHashedPassword(res, requestData.password, accountDetails.passwordHash);
    if (!isCorrectPassword) {
      await incrementFailedSignInAttempts(accountDetails.accountID);
      res.status(401).json({ success: false, message: 'Incorrect password.' });

      return;
    };

    if (!accountDetails.isVerified) {
      res.status(403).json({ success: false, message: 'Account not verified.' });
      return;
    };

    res.json({ success: true, resData: { authToken: accountDetails.authToken } });

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

  if (!isValidAuthTokenString(authToken)) {
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

    const accountDetails: { accountName: string, friendsIdString: string } = {
      accountName: rows[0].user_name,
      friendsIdString: rows[0].friends_id_string,
    };

    res.json({ success: true, resData: accountDetails })

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});