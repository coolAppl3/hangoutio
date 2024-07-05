import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import { generateAuthToken } from '../util/authTokens';
import { isValidEmail, isValidPassword, isValidName, isValidAuthTokenString } from '../util/validation/userValidation';
import { getHashedPassword } from '../services/passwordServices';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { sendVerificationEmail } from '../services/emailServices';
import { incrementVerificationEmailCount } from '../services/accountServices';
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
  // const authToken: string = generateAuthToken('account');
  const authToken: string = 'aT35BHYlHiHiXxuXjDGLyxk2xQk8KIS7';
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
        friends,
        verification_code,
        is_verified,
        verification_emails_sent,
        failed_verification_attempts,
        is_locked,
        failed_signin_attempts,
        recovery_email_timestamp
      )
      VALUES(${generatePlaceHolders(13)});`,
      [authToken, requestData.email, requestData.userName, hashedPassword, Date.now(), '', verificationCode, false, 1, 0, false, 0, 0]
    );

    res.json({ success: true, resData: { authToken } });

    const accountID: number = insertData.insertId;
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

accountsRouter.get('/resendVerificationCode', async (req: Request, res: Response) => {
  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);

  if (!isValidAuthTokenString(authToken) || authToken[0] !== 'a') {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  let accountID: number;
  let accountEmail: string;
  let verificationCode: string;
  let verificationEmailsSent: number;

  try {
    const [rows]: any = await dbPool.execute(
      `SELECT account_id, email, verification_code, verification_emails_sent FROM Accounts
      WHERE auth_token = ? LIMIT 1`,
      [authToken]
    );

    if (rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    accountID = rows[0].account_id;
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

  await incrementVerificationEmailCount(accountID, verificationEmailsSent);
  res.json({ success: true, resData: {} });

  await sendVerificationEmail(accountEmail, accountID, verificationCode);
});