import express, { Router, Request, Response } from 'express';
import { dbPool } from "../db/db";
import { isValidHangoutID } from '../util/validation/hangoutValidation';
import { isValidUserType } from '../util/validation/userValidation';

export const hangoutMembersRouter: Router = express.Router();

interface ResponseData {
  status: number,
  json: { success: boolean, resData: any } | { success: boolean, message: string },
};

interface CreateHangoutMember {
  hangoutID: string,
  userType: 'account' | 'guest',
  userID: number,
  isLeader: boolean,
};

hangoutMembersRouter.post('/', async (req: Request, res: Response) => {
  const requestData: CreateHangoutMember = req.body;

  if (!isValidHangoutID(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!isValidUserType(requestData.userType)) {
    res.status(400).json({ success: false, message: 'Invalid user type.' });
    return;
  };

  if (!Number.isInteger(requestData.userID)) {
    res.status(400).json({ success: false, message: 'Invalid user ID.' });
    return;
  };

  const { status, json }: ResponseData = await createHangoutMember(requestData);
  res.status(status).json(json);
});

async function createHangoutMember(requestData: CreateHangoutMember): Promise<ResponseData> {
  try {
    const [insertData]: any = await dbPool.execute(
      `INSERT INTO HangoutMembers(hangout_id, user_type, user_id, is_leader)
      VALUES(?, ?, ?, ?)`,
      [requestData.hangoutID, requestData.userType, Math.floor(requestData.userID), Boolean(requestData.isLeader)]
    );

    const hangoutMemberID: string = insertData.insertId;
    return { status: 200, json: { success: true, resData: { hangoutMemberID } } };

  } catch (err: any) {
    console.log(err);

    if (err.errno === 1452) {
      return { status: 400, json: { success: false, message: 'Hangout ID does not exist.' } };
    };

    if (err.errno === 1062) {
      return { status: 409, json: { success: false, message: 'User is already a part of this hangout.' } };
    };

    return { status: 500, json: { success: false, message: 'Something went wrong.' } };
  };
};