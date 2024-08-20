import { dbPool } from "../db/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import express, { Router, Request, Response } from 'express';
import * as suggestionsValidation from '../util/validation/suggestionsValidation';
import { isValidAuthTokenString } from "../util/validation/userValidation";
import { getUserID, getUserType } from "../util/userUtils";
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import { hangoutMemberLimit, isValidHangoutIDString } from "../util/validation/hangoutValidation";

export const suggestionsRouter: Router = express.Router();

suggestionsRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutMemberID: number,
    suggestionTitle: string,
    suggestionDescription: string,
  };

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

  const userID: number = getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutID', 'hangoutMemberID', 'suggestionTitle', 'suggestionDescription'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!suggestionsValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion title.' });
    return;
  };

  if (!suggestionsValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion description.' });
    return;
  };

  let connection;

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
    const [userRows] = await dbPool.execute<UserDetails[]>(
      `SELECT
        auth_token
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`,
      [userID]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== userRows[0].auth_token) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    interface HangoutDetails extends RowDataPacket {
      current_step: number,
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.current_step,
        hangout_members.hangout_member_id,
        hangout_members.account_id,
        hangout_members.guest_id
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutMemberLimit};`,
      [requestData.hangoutID]
    );

    if (hangoutRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    if (hangoutRows[0].current_step !== 2) {
      res.status(409).json({ success: false, message: 'Not in suggestions step.' });
      return;
    };

    const memberDetails: HangoutDetails | undefined = hangoutRows.find((member: HangoutDetails) => member.hangout_member_id === requestData.hangoutMemberID);
    if (!memberDetails) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (memberDetails[`${userType}_id`] !== userID) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    interface Suggestion extends RowDataPacket {
      suggestion_id: number,
    };

    const [suggestionRows] = await connection.execute<Suggestion[]>(
      `SELECT
        suggestion_id
      FROM
        suggestions
      WHERE
        hangout_member_id = ?
      LIMIT ${suggestionsValidation.suggestionsLimit};`,
      [requestData.hangoutMemberID]
    );

    if (suggestionRows.length === suggestionsValidation.suggestionsLimit) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Suggestion limit reached.' });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO suggestions(
        hangout_member_id,
        suggestion_title,
        suggestion_description
      )
      VALUES(${generatePlaceHolders(3)});`,
      [requestData.hangoutMemberID, requestData.suggestionTitle, requestData.suggestionDescription]
    );

    await connection.commit();
    res.json({ success: true, resData: { suggestionID: resultSetHeader.insertId } });

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

suggestionsRouter.put('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutMemberID: number,
    suggestionID: number,
    suggestionTitle: string,
    suggestionDescription: string,
  };

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

  const userID: number = getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutMemberID', 'suggestionID', 'suggestionTitle', 'suggestionDescription'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.suggestionID)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion ID.' });
    return;
  };

  if (!suggestionsValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion title.' });
    return;
  };

  if (!suggestionsValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion description.' });
    return;
  };

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
    const [userRows] = await dbPool.execute<UserDetails[]>(
      `SELECT
        auth_token
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`,
      [userID]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface MemberSuggestion extends RowDataPacket {
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
      suggestion_title: string,
      suggestion_description: string,
    };

    const [memberSuggestionRows] = await dbPool.execute<MemberSuggestion[]>(
      `SELECT
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id,
        suggestions.suggestion_title,
        suggestions.suggestion_description
      FROM
        hangout_members
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangout_members.hangout_member_id = ?
      LIMIT ${suggestionsValidation.suggestionsLimit};`,
      [requestData.hangoutMemberID]
    );

    if (memberSuggestionRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (memberSuggestionRows[0][`${userType}_id`] !== userID) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const suggestionToUpdate: MemberSuggestion | undefined = memberSuggestionRows.find((suggestion: MemberSuggestion) => suggestion.suggestion_id === requestData.suggestionID);
    if (!suggestionToUpdate) {
      res.status(404).json({ success: false, message: 'Suggestion not found.' });
      return;
    };

    if (
      requestData.suggestionTitle === suggestionToUpdate.suggestion_title &&
      requestData.suggestionDescription === suggestionToUpdate.suggestion_description
    ) {
      res.status(409).json({ success: false, message: 'Suggestion identical.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        suggestions
      SET
        suggestion_title = ?,
        suggestion_description = ?
      WHERE
        suggestion_id = ?;`,
      [requestData.suggestionTitle, requestData.suggestionDescription, requestData.suggestionID]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

suggestionsRouter.delete('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutMemberID: number,
    suggestionID: number,
  };

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

  const userID: number = getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutMemberID', 'suggestionID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.suggestionID)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion ID.' });
    return;
  };

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
    const [userRows] = await dbPool.execute<UserDetails[]>(
      `SELECT
        auth_token
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`,
      [userID]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface MemberSuggestion extends RowDataPacket {
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
    };

    const [memberSuggestionRows] = await dbPool.execute<MemberSuggestion[]>(
      `SELECT
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id
      FROM
        hangout_members
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangout_members.hangout_member_id = ?
      LIMIT ${suggestionsValidation.suggestionsLimit};`,
      [requestData.hangoutMemberID]
    );

    if (memberSuggestionRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (memberSuggestionRows[0][`${userType}_id`] !== userID) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const suggestionFound: boolean = memberSuggestionRows.find((suggestion: MemberSuggestion) => suggestion.suggestion_id === requestData.suggestionID) !== undefined;
    if (!suggestionFound) {
      res.status(404).json({ success: false, message: 'Suggestion not found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        suggestion_id = ?;`,
      [requestData.suggestionID]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

suggestionsRouter.delete('/clear', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutMemberID: number,
  };

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

  const userID: number = getUserID(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutMemberID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ succesS: false, message: 'Invalid hangout member ID.' });
    return;
  };

  try {
    interface UserDetails extends RowDataPacket {
      auth_token: string,
    };

    const userType: 'account' | 'guest' = getUserType(authToken);
    const [userRows] = await dbPool.execute<UserDetails[]>(
      `SELECT
        auth_token
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`,
      [userID]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface MemberSuggestion extends RowDataPacket {
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
    };

    const [memberSuggestionRows] = await dbPool.execute<MemberSuggestion[]>(
      `SELECT
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id
      FROM
        hangout_members
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangout_members.hangout_member_id = ?
      LIMIT ${suggestionsValidation.suggestionsLimit};`,
      [requestData.hangoutMemberID]
    );

    if (memberSuggestionRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (memberSuggestionRows[0][`${userType}_id`] !== userID) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (memberSuggestionRows[0].suggestion_id === null) {
      res.status(409).json({ success: false, message: 'No suggestions to clear.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        hangout_member_id = ?;`,
      [requestData.hangoutMemberID]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: { suggestionsDeleted: resultSetHeader.affectedRows } });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});