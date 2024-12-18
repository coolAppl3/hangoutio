import { dbPool } from "../db/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import express, { Router, Request, Response } from 'express';
import * as suggestionValidation from '../util/validation/suggestionValidation';
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import { isValidHangoutId } from "../util/validation/hangoutValidation";
import * as authUtils from '../auth/authUtils';
import { getRequestCookie, removeRequestCookie } from "../util/cookieUtils";
import { destroyAuthSession } from "../auth/authSessions";
import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_LIMIT, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE } from "../util/constants";

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

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionTitle', 'suggestionDescription', 'suggestionStartTimestamp', 'suggestionEndTimestamp'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
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
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    interface HangoutMemberDetails extends RowDataPacket {
      conclusion_timestamp: number,
      current_stage: number,
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMemberDetails[]>(
      `SELECT
        (
          hangouts.created_on_timestamp + hangouts.availability_period + hangouts.suggestions_period + hangouts.voting_period
        ) AS conclusion_timestamp,
        hangouts.current_stage,
        hangouts.is_concluded,
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
      LIMIT ${HANGOUT_SUGGESTIONS_LIMIT};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Hangout not found.' });

      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });

      return;
    };

    if (hangoutMemberDetails.current_stage !== HANGOUT_SUGGESTIONS_STAGE) {
      await connection.rollback();
      res.status(409).json({
        success: false,
        message: hangoutMemberDetails.is_concluded ? 'Hangout is already concluded.' : `Hangout isn't in the suggestions stage.`,
      });

      return;
    };

    if (!suggestionValidation.isValidSuggestionSlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.suggestionStartTimestamp)) {
      await connection.rollback();
      res.status(400).json({ success: false, message: 'Invalid suggestion time slot.' });

      return;
    };

    if (hangoutMemberRows.length === HANGOUT_SUGGESTIONS_LIMIT) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Suggestions limit reached.' });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO suggestions (
        hangout_member_id,
        hangout_id,
        suggestion_title,
        suggestion_description,
        suggestion_start_timestamp,
        suggestion_end_timestamp,
        is_edited
      ) VALUES (${generatePlaceHolders(7)});`,
      [requestData.hangoutMemberId, requestData.hangoutId, requestData.suggestionTitle, requestData.suggestionDescription, requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp, false]
    );

    await connection.commit();
    res.status(201).json({ success: true, resData: { suggestionId: resultSetHeader.insertId } });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });

  } finally {
    connection?.release();
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

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionId', 'suggestionTitle', 'suggestionDescription', 'suggestionStartTimestamp', 'suggestionEndTimestamp'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.suggestionId)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion ID.' });
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
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      conclusion_timestamp: number,
      current_stage: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
      suggestion_title: string,
      suggestion_description: string,
      suggestion_start_timestamp: number,
      suggestion_end_timestamp: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        (
          hangouts.created_on_timestamp + hangouts.availability_period + hangouts.suggestions_period + hangouts.voting_period
        ) AS conclusion_timestamp,
        hangouts.current_stage,
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
      LIMIT ${HANGOUT_SUGGESTIONS_LIMIT};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
      res.status(409).json({ success: false, message: `Hangout isn't in the suggestions stage.` });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_CONCLUSION_STAGE) {
      res.status(409).json({ success: false, message: 'Hangout is already concluded.' });
      return;
    };

    const suggestionToEdit: HangoutMemberDetails | undefined = hangoutMemberRows.find((suggestion: HangoutMemberDetails) => suggestion.suggestion_id === requestData.suggestionId);
    if (!suggestionToEdit) {
      res.status(404).json({ success: false, message: 'Suggestion not found.' });
      return;
    };

    if (!suggestionValidation.isValidSuggestionSlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.suggestionStartTimestamp)) {
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

    res.json({ success: true, resData: {} });

    if (requestData.suggestionTitle !== suggestionToEdit.suggestion_title && hangoutMemberDetails.current_stage === HANGOUT_VOTING_STAGE) {
      await dbPool.execute<ResultSetHeader>(
        `DELETE FROM
          votes
        WHERE
          suggestion_id = ?;`,
        [requestData.suggestionId]
      );

    };

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

suggestionsRouter.delete('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    suggestionId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.suggestionId)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion ID.' });
    return;
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      current_stage: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.current_stage,
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
      LIMIT ${HANGOUT_SUGGESTIONS_LIMIT};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
      res.status(409).json({ success: false, message: `Hangout isn't in the suggestions stage.` });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_CONCLUSION_STAGE) {
      res.status(409).json({ success: false, message: 'Hangout is already concluded.' });
      return;
    };

    const suggestionFound: boolean = hangoutMemberRows.find((suggestion: HangoutMemberDetails) => suggestion.suggestion_id === requestData.suggestionId) !== undefined;
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

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

suggestionsRouter.delete('/clear', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ succesS: false, message: 'Invalid hangout member ID.' });
    return;
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      current_stage: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.current_stage,
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
      LIMIT ${HANGOUT_SUGGESTIONS_LIMIT};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
      res.status(409).json({ success: false, message: `Hangout isn't in the suggestions stage.` });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_CONCLUSION_STAGE) {
      res.status(409).json({ success: false, message: 'Hangout is already concluded.' });
      return;
    };

    if (!hangoutMemberDetails.suggestion_id) {
      res.status(404).json({ success: false, message: 'No suggestions to clear.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        hangout_member_id = ?
      LIMIT ${HANGOUT_SUGGESTIONS_LIMIT};`,
      [requestData.hangoutMemberId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: { deletedSuggestions: resultSetHeader.affectedRows } });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

suggestionsRouter.delete('/leader/delete', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    suggestionId: number,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.suggestionId)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion ID.' });
    return;
  };

  try {
    interface AuthSessionDetails extends RowDataPacket {
      user_id: number,
      user_type: 'account' | 'guest',
      expiry_timestamp: number,
    };

    const [authSessionRows] = await dbPool.execute<AuthSessionDetails[]>(
      `SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`,
      [authSessionId]
    );

    if (authSessionRows.length === 0) {
      removeRequestCookie(res, 'authSessionId', true);
      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      current_stage: number,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
      suggestion_found: boolean,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.current_stage,
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
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (!hangoutMemberDetails.is_leader) {
      res.status(401).json({ success: false, message: 'Not hangout leader.' });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
      res.status(409).json({ success: false, message: `Hangout isn't in the suggestions stage.` });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_CONCLUSION_STAGE) {
      res.status(409).json({ success: false, message: 'Hangout is already concluded.' });
      return;
    };

    if (!hangoutMemberDetails.suggestion_found) {
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

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});