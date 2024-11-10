import { dbPool } from "../db/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import express, { Router, Request, Response } from 'express';
import * as suggestionValidation from '../util/validation/suggestionValidation';
import { isValidAuthToken } from "../util/validation/userValidation";
import { getUserId, getUserType } from "../util/userUtils";
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import { isValidHangoutId } from "../util/validation/hangoutValidation";

export const suggestionsRouter: Router = express.Router();

suggestionsRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    suggestionTitle: string,
    suggestionDescription: string,
    suggestionStartTimestamp: number,
    suggestionEndTimestamp: number,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthToken(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userId: number = getUserId(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionTitle', 'suggestionDescription', 'suggestionStartTimestamp', 'suggestionEndTimestamp'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout Id.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member Id.' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion title.' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion description.' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionTimeSlot(requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion time slot.' });
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
      [userId]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== userRows[0].auth_token) {
      res.status(400).json({ success: false, message: 'Invalid request data.' });
      return;
    };

    interface HangoutMember extends RowDataPacket {
      current_step: number,
      conclusion_timestamp: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    const [hangoutMemberRows] = await connection.execute<HangoutMember[]>(
      `SELECT
        hangouts.current_step,
        hangouts.conclusion_timestamp,
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${suggestionValidation.suggestionsLimit};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Hangout not found.' });

      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userId) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    if (hangoutMember.current_step !== 2) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Not in suggestions step.' });

      return;
    };

    if (!suggestionValidation.isValidSuggestionSlotStart(hangoutMember.conclusion_timestamp, requestData.suggestionStartTimestamp)) {
      await connection.rollback();
      res.status(400).json({ success: false, message: 'Invalid suggestion time slot.' });

      return;
    };

    if (hangoutMemberRows.length === suggestionValidation.suggestionsLimit) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Suggestion limit reached.' });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO suggestions(
        hangout_member_id,
        hangout_id,
        suggestion_title,
        suggestion_description,
        suggestion_start_timestamp,
        suggestion_end_timestamp,
        is_edited
      )
      VALUES(${generatePlaceHolders(7)});`,
      [requestData.hangoutMemberId, requestData.hangoutId, requestData.suggestionTitle, requestData.suggestionDescription, requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp, false]
    );

    await connection.commit();
    res.status(201).json({ success: true, resData: { suggestionId: resultSetHeader.insertId } });

  } catch (err: unknown) {
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

suggestionsRouter.patch('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    suggestionId: number,
    suggestionTitle: string,
    suggestionDescription: string,
    suggestionStartTimestamp: number,
    suggestionEndTimestamp: number,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthToken(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userId: number = getUserId(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionId', 'suggestionTitle', 'suggestionDescription', 'suggestionStartTimestamp', 'suggestionEndTimestamp'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout Id.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member Id.' });
    return;
  };

  if (!Number.isInteger(requestData.suggestionId)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion Id.' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion title.' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion description.' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionTimeSlot(requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion time slot.' });
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
      [userId]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutMember extends RowDataPacket {
      current_step: number,
      conclusion_timestamp: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
      suggestion_title: string,
      suggestion_description: string,
      suggestion_start_timestamp: number,
      suggestion_end_timestamp: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        hangouts.current_step,
        hangouts.conclusion_timestamp,
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id,
        suggestions.suggestion_title,
        suggestions.suggestion_description,
        suggestions.suggestion_start_timestamp,
        suggestions.suggestion_end_timestamp
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${suggestionValidation.suggestionsLimit};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userId) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutMember.current_step === 1) {
      res.status(409).json({ success: false, message: 'Not in suggestions step.' });
      return;
    };

    if (hangoutMember.current_step === 4) {
      res.status(409).json({ success: false, message: 'Hangout concluded.' });
      return;
    };

    const suggestionToEdit: HangoutMember | undefined = hangoutMemberRows.find((suggestion: HangoutMember) => suggestion.suggestion_id === requestData.suggestionId);
    if (!suggestionToEdit) {
      res.status(404).json({ success: false, message: 'Suggestion not found.' });
      return;
    };

    if (!suggestionValidation.isValidSuggestionSlotStart(hangoutMember.conclusion_timestamp, requestData.suggestionStartTimestamp)) {
      res.status(400).json({ success: false, message: 'Invalid suggestion time slot.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        suggestions
      SET
        suggestion_title = ?,
        suggestion_description = ?,
        suggestion_start_timestamp = ?,
        suggestion_end_timestamp = ?,
        is_edited = ?
      WHERE
        suggestion_id = ?;`,
      [requestData.suggestionTitle, requestData.suggestionDescription, requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp, true, requestData.suggestionId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    let deletedVotes: number = 0;
    if (requestData.suggestionTitle !== suggestionToEdit.suggestion_title && hangoutMember.current_step === 3) {
      const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
        `DELETE FROM
          votes
        WHERE
          suggestion_id = ?;`,
        [requestData.suggestionId]
      );

      deletedVotes = resultSetHeader.affectedRows;
    };

    res.json({ success: true, resData: { deletedVotes } });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

suggestionsRouter.delete('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    suggestionId: number,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthToken(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userId: number = getUserId(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout Id.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member Id.' });
    return;
  };

  if (!Number.isInteger(requestData.suggestionId)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion Id.' });
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
      [userId]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutMember extends RowDataPacket {
      current_step: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        hangouts.current_step,
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${suggestionValidation.suggestionsLimit};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userId) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutMember.current_step !== 2) {
      res.status(409).json({ success: false, message: 'Not in suggestions step.' });
      return;
    };

    const suggestionFound: boolean = hangoutMemberRows.find((suggestion: HangoutMember) => suggestion.suggestion_id === requestData.suggestionId) !== undefined;
    if (!suggestionFound) {
      res.status(404).json({ success: false, message: 'Suggestion not found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        suggestion_id = ?;`,
      [requestData.suggestionId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

suggestionsRouter.delete('/clear', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthToken(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userId: number = getUserId(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout Id.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ succesS: false, message: 'Invalid hangout member Id.' });
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
      [userId]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutMember extends RowDataPacket {
      current_step: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        hangouts.current_step AS current_step,
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${suggestionValidation.suggestionsLimit};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userId) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutMember.current_step !== 2) {
      res.status(409).json({ success: false, message: 'Not in suggestions step.' });
      return;
    };

    if (!hangoutMember.suggestion_id) {
      res.status(404).json({ success: false, message: 'No suggestions found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        hangout_member_id = ?
      LIMIT ${suggestionValidation.suggestionsLimit};`,
      [requestData.hangoutMemberId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: { deletedSuggestions: resultSetHeader.affectedRows } });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

suggestionsRouter.delete('/leader/delete', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    suggestionId: number,
  };

  const authHeader: string | undefined = req.headers['authorization'];
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const authToken: string = authHeader.substring(7);
  if (!isValidAuthToken(authToken)) {
    res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
    return;
  };

  const userId: number = getUserId(authToken);
  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout Id.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member Id.' });
    return;
  };

  if (!Number.isInteger(requestData.suggestionId)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion Id.' });
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
      [userId]
    );

    if (userRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (authToken !== userRows[0].auth_token) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    interface HangoutMember extends RowDataPacket {
      current_step: number,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
      suggestion_found: boolean,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        hangouts.current_step,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        (SELECT 1 FROM suggestions WHERE suggestion_id = ?) as suggestion_found
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id,
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT 1;`,
      [requestData.suggestionId, requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userId) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (!hangoutMember.is_leader) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
      return;
    };

    if (hangoutMember.current_step !== 2) {
      res.status(409).json({ success: false, message: 'Not in suggestions step.' });
      return;
    };

    if (!hangoutMember.suggestion_found) {
      res.status(404).json({ success: false, message: 'Suggestion not found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        suggestion_id = ?;`,
      [requestData.suggestionId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});