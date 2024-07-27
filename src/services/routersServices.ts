import { Response } from "express"
import bcrypt from 'bcrypt';
import { generateAuthToken, generateHangoutID } from "../util/tokenGenerator"
import { generatePlaceHolders } from "../util/generatePlaceHolders"

interface NewGuestData {
  username: string,
  hashedPassword: string,
  displayName: string,
  hangoutID: string,
};

export async function createGuestAccount(connection: any, res: Response, newGuestData: NewGuestData, attemptNumber: number = 1): Promise<string | false> {
  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return false;
  };

  const authToken = generateAuthToken('guest');

  try {
    await connection.execute(
      `INSERT INTO Guests(
        auth_token,
        username,
        hashed_password,
        display_name,
        hangout_id
      )
      VALUES(${generatePlaceHolders(5)});`,
      [authToken, newGuestData.username, newGuestData.hashedPassword, newGuestData.displayName, newGuestData.hangoutID]
    );

    return authToken;

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (err.errno === 1452) {
      res.status(404).json({ succesS: false, message: 'Hangout not found.' });
      return false;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'username'`)) {
      res.status(409).json({ success: false, message: 'Username is taken.' });
      return false;
    };

    if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
      return await createGuestAccount(connection, res, newGuestData, ++attemptNumber);
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
    return false;
  };
};

interface NewHangoutData {
  hangoutPassword: string | null,
  memberLimit: number,
  availabilityPeriod: number,
  suggestionsPeriod: number,
  votingPeriod: number,
};

export async function createHangout(connection: any, res: Response, NewHangoutData: NewHangoutData, attemptNumber: number = 1): Promise<string | false> {
  if (attemptNumber > 3) {
    res.status(500).json({ success: false, message: 'Internal server error.' });
    return false;
  };

  const hangoutID: string = generateHangoutID();

  try {
    let hashedPassword: string | null = null;

    if (NewHangoutData.hangoutPassword) {
      hashedPassword = await bcrypt.hash(NewHangoutData.hangoutPassword, 10);
    };

    await connection.execute(
      `INSERT INTO Hangouts(
        hangout_id,
        hashed_password,
        member_limit,
        availability_period,
        suggestions_period,
        voting_period,
        current_step,
        step_timestamp,
        created_on_timestamp,
        completed_on_timestamp
      )
      VALUES(${generatePlaceHolders(10)});`,
      [hangoutID, hashedPassword, NewHangoutData.memberLimit, NewHangoutData.availabilityPeriod, NewHangoutData.suggestionsPeriod, NewHangoutData.votingPeriod, 1, Date.now(), Date.now(), null]
    );

    return hangoutID;

  } catch (err: any) {
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

    if (err.errno === 1062) {
      return await createHangout(connection, res, NewHangoutData, ++attemptNumber);
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
    return false;
  };
};