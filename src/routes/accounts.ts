import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import { generateAccountAuthToken } from '../util/generateAuthToken';
import { isValidEmail, isValidPassword, isValidName } from '../util/validation/userValidation';

import bcrypt from 'bcrypt';
import { hashPassword } from '../util/passwordHash';
const bcryptSaltRounds: number = 10;

export const accountsRouter: Router = express.Router();

interface ResponseData {
  status: number,
  json: { success: boolean, resData: any } | { success: boolean, message: string },
};

interface CreateAccount {
  email: string,
  password: string,
  accountName: string,
};

accountsRouter.post('/signUp', async (req: Request, res: Response) => {
  const requestData: CreateAccount = req.body;

  if (!isValidEmail(requestData.email)) {
    res.status(400).json({ success: false, message: 'Invalid email address.' });
    return;
  };

  if (!isValidName(requestData.accountName)) {
    res.status(400).json({ success: false, message: 'Invalid account name.' });
    return;
  };

  if (!isValidPassword(requestData.password)) {
    res.status(400).json({ success: false, message: 'Invalid password.' });
    return;
  };

  const hashedPassword: string = await hashPassword(requestData.password);

  if (hashPassword.length === 0) {
    res.status(500).json({ success: false, message: 'Something went wrong.' });
    return;
  };

  const { status, json }: ResponseData = await createAccount(requestData, hashedPassword);
  res.status(status).json(json);
});

async function createAccount(requestData: CreateAccount, hashedPassword: string, attemptNumber: number = 1): Promise<ResponseData> {
  const authToken: string = generateAccountAuthToken();

  if (attemptNumber > 3) {
    return { status: 500, json: { success: false, message: 'Something went wrong.' } };
  };

  try {
    await dbPool.execute(
      `INSERT INTO Accounts(auth_token, email, password_hash, account_name, is_verified, created_on_timestamp, friends)
      VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [authToken, requestData.email, hashedPassword, requestData.accountName, false, Date.now(), '']
    );

    return { status: 200, json: { success: true, resData: { authToken } } };

  } catch (err: any) {
    console.log(err)

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
      return { status: 409, json: { success: false, message: 'Email address is already in use.' } };
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await createAccount(requestData, hashedPassword, attemptNumber++);
    };

    return { status: 500, json: { success: false, message: 'Something went wrong.' } };
  };
};