import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import { generateAuthToken } from '../util/authTokens';
import { isValidEmail, isValidPassword, isValidName } from '../util/validation/userValidation';
import { getHashedPassword } from '../services/passwordServices';
import { undefinedValuesDetected } from '../util/validation/requestValidation';

export const accountsRouter: Router = express.Router();

interface ResponseData {
  status: number,
  json: { success: boolean, resData: any } | { success: boolean, message: string },
};

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

  const { status, json }: ResponseData = await createAccount(requestData, hashedPassword);
  res.status(status).json(json);
});

async function createAccount(requestData: CreateAccount, hashedPassword: string, attemptNumber: number = 1): Promise<ResponseData> {
  const authToken: string = generateAuthToken('account');

  if (attemptNumber > 3) {
    return { status: 500, json: { success: false, message: 'Internal server error.' } };
  };

  try {
    await dbPool.execute(
      `INSERT INTO Accounts(auth_token, email, password_hash, user_name, is_verified, created_on_timestamp, friends)
      VALUES(?, ?, ?, ?, ?, ?, ?);`,
      [authToken, requestData.email, hashedPassword, requestData.userName, false, Date.now(), '']
    );

    return { status: 200, json: { success: true, resData: { authToken } } };

  } catch (err: any) {
    console.log(err)

    if (!err.errno) {
      return { status: 400, json: { success: false, message: 'Invalid request data.' } };
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
      return { status: 409, json: { success: false, message: 'Email address is already in use.' } };
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await createAccount(requestData, hashedPassword, attemptNumber++);
    };

    return { status: 500, json: { success: false, message: 'Internal server error.' } };
  };
};