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
import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_SUGGESTIONS_LIMIT, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE } from "../util/constants";
import { Suggestion, SuggestionLike, Vote } from "../util/hangoutTypes";
import { isSqlError } from "../util/isSqlError";
import { sendHangoutWebSocketMessage } from "../webSockets/hangout/hangoutWebSocketServer";
import { logUnexpectedError } from "../logs/errorLogger";

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
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionTitle', 'suggestionDescription', 'suggestionStartTimestamp', 'suggestionEndTimestamp'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
    res.status(400).json({ message: 'Invalid suggestion title.', reason: 'invalidTitle' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
    res.status(400).json({ message: 'Invalid suggestion description.', reason: 'invalidDescription' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionTimeSlot(requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp)) {
    res.status(400).json({ message: 'Invalid suggestion time slot.', reason: 'invalidSlot' });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
    await connection.beginTransaction();

    interface HangoutMemberDetails extends RowDataPacket {
      conclusion_timestamp: number,
      is_concluded: boolean,
      current_stage: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_id: number,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMemberDetails[]>(
      `SELECT
        (
          hangouts.created_on_timestamp + hangouts.availability_period + hangouts.suggestions_period + hangouts.voting_period
        ) AS conclusion_timestamp,
        hangouts.is_concluded,
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

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutMemberRows[0];

    if (!hangoutMemberDetails) {
      await connection.rollback();
      res.status(404).json({ message: 'Hangout not found.' });

      return;
    };

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      await connection.rollback();
      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });

      return;
    };

    if (hangoutMemberDetails.is_concluded) {
      await connection.rollback();
      res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });

      return;
    };

    if (hangoutMemberDetails.current_stage !== HANGOUT_SUGGESTIONS_STAGE) {
      const reason: string = hangoutMemberDetails.current_stage === HANGOUT_AVAILABILITY_STAGE
        ? 'inAvailabilityStage'
        : 'inVotingStage';
      // 

      await connection.rollback();
      res.status(403).json({ message: `Hangout isn't in the suggestions stage.`, reason });

      return;
    };

    if (!suggestionValidation.isValidSuggestionSlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.suggestionStartTimestamp)) {
      await connection.rollback();
      res.status(400).json({ message: 'Invalid suggestion time slot.', reason: 'invalidSlot' });

      return;
    };

    if (hangoutMemberRows.length === HANGOUT_SUGGESTIONS_LIMIT) {
      await connection.rollback();
      res.status(409).json({ message: `Suggestions limit of ${HANGOUT_SUGGESTIONS_LIMIT} reached.`, reason: 'limitReached' });

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
    res.status(201).json({ suggestionId: resultSetHeader.insertId });

    sendHangoutWebSocketMessage([requestData.hangoutId], {
      type: 'suggestion',
      reason: 'newSuggestion',
      data: {
        newSuggestion: {
          suggestion_id: resultSetHeader.insertId,
          hangout_member_id: requestData.hangoutMemberId,
          suggestion_title: requestData.suggestionTitle,
          suggestion_description: requestData.suggestionDescription,
          suggestion_start_timestamp: requestData.suggestionStartTimestamp,
          suggestion_end_timestamp: requestData.suggestionEndTimestamp,
          is_edited: false,
          likes_count: 0,
          votes_count: 0,
        },
      },
    });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
    await logUnexpectedError(req, err);

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
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionId', 'suggestionTitle', 'suggestionDescription', 'suggestionStartTimestamp', 'suggestionEndTimestamp'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.suggestionId)) {
    res.status(400).json({ message: 'Invalid suggestion ID.' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
    res.status(400).json({ message: 'Invalid suggestion title.', reason: 'invalidTitle' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
    res.status(400).json({ message: 'Invalid suggestion description.', reason: 'invalidDescription' });
    return;
  };

  if (!suggestionValidation.isValidSuggestionTimeSlot(requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp)) {
    res.status(400).json({ message: 'Invalid suggestion time slot.', reason: 'invalidSlot' });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      conclusion_timestamp: number,
      is_concluded: boolean,
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
        hangouts.is_concluded,
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

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutMemberRows[0];

    if (!hangoutMemberDetails) {
      res.status(404).json({ message: 'Hangout not found.', reason: 'hangoutNotfound' });
      return;
    };

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.is_concluded) {
      res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
      res.status(403).json({ message: `Hangout isn't in the suggestions stage.`, reason: 'inAvailabilityStage' });
      return;
    };

    const suggestionToEdit: HangoutMemberDetails | undefined = hangoutMemberRows.find((suggestion: HangoutMemberDetails) => suggestion.suggestion_id === requestData.suggestionId);
    if (!suggestionToEdit) {
      res.status(404).json({ message: 'Suggestion not found.', reason: 'suggestionNotFound' });
      return;
    };

    if (!suggestionValidation.isValidSuggestionSlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.suggestionStartTimestamp)) {
      res.status(400).json({ message: 'Invalid suggestion time slot.', reason: 'invalidSlot' });
      return;
    };

    let isIdentical: boolean = true;
    let isMajorChange: boolean = false;

    if (suggestionToEdit.suggestion_start_timestamp !== requestData.suggestionStartTimestamp) {
      isIdentical = false;
      isMajorChange = true;
    };

    if (suggestionToEdit.suggestion_end_timestamp !== requestData.suggestionEndTimestamp) {
      isIdentical = false;
      isMajorChange = true;
    };

    if (suggestionToEdit.suggestion_title !== requestData.suggestionTitle) {
      isIdentical = false;
      isMajorChange = true;
    };

    if (suggestionToEdit.suggestion_description !== requestData.suggestionDescription) {
      isIdentical = false;
    };

    if (isIdentical) {
      res.status(409).json({ message: 'No suggestion changes found.' });
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
      res.status(500).json({ message: 'Internal server error.' });
      await logUnexpectedError(req, { message: 'Failed to update rows.', trace: null });

      return;
    };

    res.json({ isMajorChange });

    if (isMajorChange) {
      await dbPool.query(
        `DELETE FROM
          votes
        WHERE
          suggestion_id = :suggestionId;
        
        DELETE FROM
          suggestion_likes
        WHERE
          suggestion_id = :suggestionId;`,
        { suggestionId: requestData.suggestionId }
      );
    };

    sendHangoutWebSocketMessage([requestData.hangoutId], {
      type: 'suggestion',
      reason: 'suggestionUpdated',
      data: {
        isMajorChange,
        updatedSuggestion: {
          suggestion_id: requestData.suggestionId,
          hangout_member_id: requestData.hangoutMemberId,
          suggestion_title: requestData.suggestionTitle,
          suggestion_description: requestData.suggestionDescription,
          suggestion_start_timestamp: requestData.suggestionStartTimestamp,
          suggestion_end_timestamp: requestData.suggestionEndTimestamp,
          is_edited: true,
          likes_count: 0,
          votes_count: 0,
        },
      },
    });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
    await logUnexpectedError(req, err);
  };
});

suggestionsRouter.delete('/', async (req: Request, res: Response) => {
  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const suggestionId = req.query.suggestionId;
  const hangoutMemberId = req.query.hangoutMemberId;
  const hangoutId = req.query.hangoutId;

  if (typeof suggestionId !== 'string' || typeof hangoutMemberId !== 'string' || typeof hangoutId !== 'string') {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(+suggestionId)) {
    res.status(400).json({ message: 'Invalid suggestion ID.' });
    return;
  };

  if (!Number.isInteger(+hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
    return;
  };

  if (!isValidHangoutId(hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      is_concluded: boolean,
      current_stage: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_found: boolean,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.is_concluded,
        hangouts.current_stage,
        hangout_members.account_id,
        hangout_members.guest_id,
        EXISTS (SELECT 1 FROM suggestions WHERE suggestion_id = ?) AS suggestion_found
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT 1;`,
      [+suggestionId, hangoutId, +hangoutMemberId]
    );

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutMemberRows[0];

    if (!hangoutMemberDetails) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
      res.status(403).json({ message: `Hangout isn't in the suggestions stage.`, reason: 'inAvailabilityStage' });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_VOTING_STAGE) {
      res.status(403).json({ message: `Suggestions can't be deleted after the suggestions stage ends.`, reason: 'inVotingStage' });
      return;
    };

    if (hangoutMemberDetails.is_concluded) {
      res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });
      return;
    };

    if (!hangoutMemberDetails.suggestion_found) {
      res.json({});
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        suggestion_id = ?;`,
      [+suggestionId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      await logUnexpectedError(req, { message: 'Failed to delete rows.', trace: null });

      return;
    };

    res.json({});

    sendHangoutWebSocketMessage([hangoutId], {
      type: 'suggestion',
      reason: 'suggestionDeleted',
      data: {
        hangoutMemberId: +hangoutMemberId,
        deletedSuggestionId: +suggestionId,
      },
    });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
    await logUnexpectedError(req, err);
  };
});

suggestionsRouter.delete('/leader', async (req: Request, res: Response) => {
  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const suggestionId = req.query.suggestionId;
  const hangoutMemberId = req.query.hangoutMemberId;
  const hangoutId = req.query.hangoutId;

  if (typeof suggestionId !== 'string' || typeof hangoutMemberId !== 'string' || typeof hangoutId !== 'string') {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(+suggestionId)) {
    res.status(400).json({ message: 'Invalid suggestion ID.' });
    return;
  };

  if (!Number.isInteger(+hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
    return;
  };

  if (!isValidHangoutId(hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      is_concluded: boolean,
      current_stage: number,
      account_id: number | null,
      guest_id: number | null,
      is_leader: boolean,
      suggestion_found: boolean,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.is_concluded,
        hangouts.current_stage,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        EXISTS (SELECT 1 FROM suggestions WHERE suggestion_id = ?) as suggestion_found
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT 1;`,
      [+suggestionId, hangoutId, +hangoutMemberId]
    );

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutMemberRows[0];

    if (!hangoutMemberDetails) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (!hangoutMemberDetails.is_leader) {
      res.status(401).json({ message: `You're not the hangout leader.` });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
      res.status(403).json({ message: `Hangout isn't in the suggestions stage.`, reason: 'inAvailabilityStage' });
      return;
    };

    if (hangoutMemberDetails.current_stage === HANGOUT_VOTING_STAGE) {
      res.status(403).json({ message: `Suggestions can't be deleted after the suggestions stage ends.`, reason: 'inVotingStage' });
      return;
    };

    if (hangoutMemberDetails.is_concluded) {
      res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });
      return;
    };

    if (!hangoutMemberDetails.suggestion_found) {
      res.json({});
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestions
      WHERE
        suggestion_id = ?;`,
      [+suggestionId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      await logUnexpectedError(req, { message: 'Failed to delete rows.', trace: null });

      return;
    };

    res.json({});

    sendHangoutWebSocketMessage([hangoutId], {
      type: 'suggestion',
      reason: 'suggestionDeletedByLeader',
      data: {
        deletedSuggestionId: +suggestionId,
      },
    });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
    await logUnexpectedError(req, err);
  };
});

suggestionsRouter.get('/', async (req: Request, res: Response) => {
  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const hangoutId = req.query.hangoutId;
  const hangoutMemberId = req.query.hangoutMemberId;

  if (typeof hangoutId !== 'string' || typeof hangoutMemberId !== 'string') {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutId(hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(+hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    const [validationRows] = await dbPool.execute<RowDataPacket[]>(
      `SELECT
        1
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        hangout_id = ?;`,
      [+hangoutMemberId, hangoutId]
    );

    if (validationRows.length === 0) {
      res.status(401).json({ message: `Hangout not found or you're not a member of it.`, reason: 'notHangoutMember' });
      return;
    };

    type SuggestionInfo = [
      Suggestion[],
      SuggestionLike[],
      Vote[],
    ];

    const [suggestionInfoRows] = await dbPool.query<SuggestionInfo>(
      `SELECT
        suggestion_id,
        hangout_member_id,
        suggestion_title,
        suggestion_description,
        suggestion_start_timestamp,
        suggestion_end_timestamp,
        is_edited
      FROM
        suggestions
      WHERE
        hangout_id = :hangoutId;
      
      SELECT
        suggestion_like_id,
        hangout_member_id,
        suggestion_id
      FROM
        suggestion_likes
      WHERE
        hangout_id = :hangoutId;
      
      SELECT
        vote_id,
        hangout_member_id,
        suggestion_id
      FROM
        votes
      WHERE
        hangout_id = :hangoutId;`,
      { hangoutId }
    );

    const suggestions: Suggestion[] = suggestionInfoRows[0];
    const suggestionLikes: SuggestionLike[] = suggestionInfoRows[1];
    const votes: Vote[] = suggestionInfoRows[2];

    const suggestionLikesMap: Map<number, number> = new Map();
    const memberLikes: number[] = [];

    for (const suggestionLike of suggestionLikes) {
      if (suggestionLike.hangout_member_id === +hangoutMemberId) {
        memberLikes.push(suggestionLike.suggestion_id);
      };

      const suggestionLikeCount: number | undefined = suggestionLikesMap.get(suggestionLike.suggestion_id);

      if (!suggestionLikeCount) {
        suggestionLikesMap.set(suggestionLike.suggestion_id, 1);
        continue;
      };

      suggestionLikesMap.set(suggestionLike.suggestion_id, suggestionLikeCount + 1);
    };

    const suggestionVotesMap: Map<number, number> = new Map();
    const memberVotes: number[] = [];

    for (const vote of votes) {
      if (vote.hangout_member_id === +hangoutMemberId) {
        memberVotes.push(vote.suggestion_id);
      };

      const suggestionVotesCount: number | undefined = suggestionVotesMap.get(vote.suggestion_id);

      if (!suggestionVotesCount) {
        suggestionVotesMap.set(vote.suggestion_id, 1);
        continue;
      };

      suggestionVotesMap.set(vote.suggestion_id, suggestionVotesCount + 1);
    };

    interface CountedSuggestion extends Suggestion {
      likes_count: number,
      votes_count: number,
    };

    const countedSuggestions: CountedSuggestion[] = [];

    for (const suggestion of suggestions) {
      const likes_count: number | undefined = suggestionLikesMap.get(suggestion.suggestion_id);
      const votes_count: number | undefined = suggestionVotesMap.get(suggestion.suggestion_id);

      countedSuggestions.push({
        ...suggestion,
        likes_count: likes_count ? likes_count : 0,
        votes_count: votes_count ? votes_count : 0,
      });
    };

    res.json({
      suggestions: countedSuggestions,
      memberLikes,
      memberVotes,
    });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
    await logUnexpectedError(req, err);
  };
});

suggestionsRouter.post('/likes', async (req: Request, res: Response) => {
  interface RequestData {
    suggestionId: number,
    hangoutMemberId: number,
    hangoutId: string,
  };

  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['suggestionId', 'hangoutMemberId', 'hangoutId'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.suggestionId)) {
    res.status(400).json({ message: 'Invalid suggestion ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
    return;
  };

  if (!isValidHangoutId(requestData.hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface MemberSuggestionDetails extends RowDataPacket {
      is_member: boolean,
      suggestion_exists: boolean,
      already_liked: boolean
    };

    const [memberSuggestionRows] = await dbPool.execute<MemberSuggestionDetails[]>(
      `SELECT
        EXISTS (
          SELECT
            1
          FROM
            hangout_members
          WHERE
            hangout_member_id = :hangoutMemberId AND
            hangout_id = :hangoutId
        ) AS is_member,

        EXISTS (
          SELECT
            1
          FROM
            suggestions
          WHERE
            suggestion_id = :suggestionId
        ) as suggestion_exists,
         
        EXISTS (
          SELECT
            1
          FROM
            suggestion_likes
          WHERE
            hangout_member_id = :hangoutMemberId AND
            suggestion_id = :suggestionId
        ) as already_liked;`,
      { suggestionId: requestData.suggestionId, hangoutMemberId: requestData.hangoutMemberId, hangoutId: requestData.hangoutId }
    );

    const memberSuggestionDetails: MemberSuggestionDetails | undefined = memberSuggestionRows[0];

    if (!memberSuggestionDetails) {
      res.status(500).json({ message: 'Internal server error.' });
      await logUnexpectedError(req, { message: 'Failed to fetch rows.', trace: null });

      return;
    };

    if (!memberSuggestionDetails.is_member) {
      res.status(401).json({ message: 'Not a member of this hangout.', reason: 'notHangoutMember' });
      return;
    };

    if (!memberSuggestionDetails.suggestion_exists) {
      res.status(404).json({ message: 'Suggestion not found.' });
      return;
    };

    if (memberSuggestionDetails.already_liked) {
      res.json({});
      return;
    };

    await dbPool.execute<ResultSetHeader>(
      `INSERT INTO suggestion_likes (
        suggestion_id,
        hangout_member_id,
        hangout_id
      ) VALUES (${generatePlaceHolders(3)});`,
      [requestData.suggestionId, requestData.hangoutMemberId, requestData.hangoutId]
    );

    res.json({});

    sendHangoutWebSocketMessage([requestData.hangoutId], {
      type: 'like',
      reason: 'likeAdded',
      data: {
        hangoutMemberId: requestData.hangoutMemberId,
        suggestionId: requestData.suggestionId,
      },
    });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    if (!isSqlError(err)) {
      res.status(500).json({ message: 'Internal server error.' });
      await logUnexpectedError(req, err);

      return;
    };

    const sqlError: SqlError = err;

    if (sqlError.errno === 1062) {
      res.status(409).json({ message: 'Already liked this suggestion.' });
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
    await logUnexpectedError(req, err);
  };
});

suggestionsRouter.delete('/likes', async (req: Request, res: Response) => {
  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId');
    res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const suggestionId = req.query.suggestionId;
  const hangoutMemberId = req.query.hangoutMemberId;
  const hangoutId = req.query.hangoutId;

  if (typeof suggestionId !== 'string' || typeof hangoutMemberId !== 'string' || typeof hangoutId !== 'string') {
    res.status(400).json({ message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(+suggestionId)) {
    res.status(400).json({ message: 'Invalid suggestion ID.' });
    return;
  };

  if (!Number.isInteger(+hangoutMemberId)) {
    res.status(400).json({ message: 'Invalid hangout member ID.' });
    return;
  };

  if (!isValidHangoutId(hangoutId)) {
    res.status(400).json({ message: 'Invalid hangout ID.' });
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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0];

    if (!authSessionDetails) {
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface MemberSuggestionDetails extends RowDataPacket {
      is_member: boolean,
      like_exists: boolean
    };

    const [memberSuggestionRows] = await dbPool.execute<MemberSuggestionDetails[]>(
      `SELECT
        EXISTS (
          SELECT
            1
          FROM
            hangout_members
          WHERE
            hangout_member_id = :hangoutMemberId AND
            hangout_id = :hangoutId
        ) AS is_member,

        EXISTS (
          SELECT
            1
          FROM
            suggestion_likes
          WHERE
            suggestion_id = :suggestionId AND
            hangout_member_id = :hangoutMemberId
          LIMIT 1
        ) as like_exists;`,
      { suggestionId: +suggestionId, hangoutMemberId: +hangoutMemberId, hangoutId }
    );

    const memberSuggestionDetails: MemberSuggestionDetails | undefined = memberSuggestionRows[0];

    if (!memberSuggestionDetails) {
      res.status(500).json({ message: 'Internal server error.' });
      await logUnexpectedError(req, { message: 'Failed to fetch rows.', trace: null });
      return;
    };

    if (!memberSuggestionDetails.is_member) {
      res.status(401).json({ message: 'Not a member of this hangout.', reason: 'notHangoutMember' });
      return;
    };

    if (!memberSuggestionDetails.like_exists) {
      res.json({});
      return;
    };

    await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        suggestion_likes
      WHERE
        suggestion_id = ? AND
        hangout_member_id = ?;`,
      [suggestionId, hangoutMemberId]
    );

    res.json({});

    sendHangoutWebSocketMessage([hangoutId], {
      type: 'like',
      reason: 'likeDeleted',
      data: {
        hangoutMemberId: +hangoutMemberId,
        suggestionId: +suggestionId,
      },
    });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
    await logUnexpectedError(req, err);
  };
});