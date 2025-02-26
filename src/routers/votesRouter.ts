import { dbPool } from "../db/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import express, { Router, Request, Response } from "express";
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { isValidHangoutId } from "../util/validation/hangoutValidation";
import * as voteValidation from '../util/validation/voteValidation';
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import * as authUtils from '../auth/authUtils';
import { getRequestCookie, removeRequestCookie } from "../util/cookieUtils";
import { destroyAuthSession } from "../auth/authSessions";
import { HANGOUT_AVAILABILITY_SLOTS_LIMIT, HANGOUT_VOTES_LIMIT, HANGOUT_VOTING_STAGE } from "../util/constants";

export const votesRouter: Router = express.Router();

votesRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    suggestionId: number,
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

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'suggestionId'];
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
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutMemberDetails extends RowDataPacket {
      is_concluded: boolean,
      current_stage: number,
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_found: boolean,
      already_voted: boolean,
      total_votes: number,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.is_concluded,
        hangouts.current_stage,
        hangout_members.account_id,
        hangout_members.guest_id,
        EXISTS (SELECT 1 FROM suggestions WHERE suggestion_id = :suggestionId) AS suggestion_found,
        EXISTS (SELECT 1 FROM votes WHERE hangout_member_id = :hangoutMemberId AND suggestion_id = :suggestionId) AS already_voted,
        (SELECT COUNT(*) FROM votes WHERE hangout_member_id = :hangoutMemberId LIMIT :votesLimit) AS total_votes
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = :hangoutId AND
        hangout_members.hangout_member_id = :hangoutMemberId
      LIMIT 1;`,
      {
        suggestionId: requestData.suggestionId,
        hangoutMemberId: requestData.hangoutMemberId,
        hangoutId: requestData.hangoutMemberId,
        votesLimit: HANGOUT_VOTES_LIMIT
      }
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ message: 'Hangout not found.' });

      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      await connection.rollback();
      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });

      return;
    };

    if (hangoutMemberDetails.is_concluded) {
      res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });
      return;
    };

    if (hangoutMemberDetails.current_stage !== HANGOUT_VOTING_STAGE) {
      res.status(403).json({ message: `Hangout hasn't reached the voting stage yet.`, reason: 'inAvailabilityStage' });
      return;
    };

    if (!hangoutMemberDetails.suggestion_found) {
      await connection.rollback();
      res.status(404).json({ message: 'Suggestion not found.' });

      return;
    };

    if (hangoutMemberDetails.already_voted) {
      await connection.rollback();
      res.status(409).json({ message: `You've already voted for this suggestion.` });

      return;
    };

    if (hangoutMemberDetails.total_votes >= HANGOUT_VOTES_LIMIT) {
      await connection.rollback();
      res.status(409).json({ message: 'Votes limit reached.' });

      return;
    };

    interface SuggestionAvailabilitySlots extends RowDataPacket {
      suggestion_start_timestamp: number,
      suggestion_end_timestamp: number,
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const [suggestionAvailabilityRows] = await connection.execute<SuggestionAvailabilitySlots[]>(
      `SELECT
        suggestions.suggestion_start_timestamp,
        suggestions.suggestion_end_timestamp,
        availability_slots.slot_start_timestamp,
        availability_slots.slot_end_timestamp
      FROM
        suggestions
      INNER JOIN
        availability_slots ON suggestions.hangout_id = availability_slots.hangout_id
      WHERE
        suggestions.suggestion_id = ? AND
        availability_slots.hangout_member_id = ?
      LIMIT ${HANGOUT_AVAILABILITY_SLOTS_LIMIT};`,
      [requestData.suggestionId, requestData.hangoutMemberId]
    );

    if (suggestionAvailabilityRows.length === 0) {
      await connection.rollback();
      res.status(409).json({ message: `Your availability doesn't match this suggestions time slot.` });

      return;
    };

    interface SuggestionTimeSlot {
      start: number,
      end: number,
    };

    const suggestionTimeSlot: SuggestionTimeSlot = {
      start: suggestionAvailabilityRows[0].suggestion_start_timestamp,
      end: suggestionAvailabilityRows[0].suggestion_end_timestamp,
    };

    interface AvailabilitySlot {
      start: number,
      end: number,
    };

    const availabilitySlots: AvailabilitySlot[] = suggestionAvailabilityRows.map((row) => ({
      start: row.slot_start_timestamp,
      end: row.slot_end_timestamp,
    }));

    if (!voteValidation.isAvailableForSuggestion(suggestionTimeSlot, availabilitySlots)) {
      await connection.rollback();
      res.status(409).json({ message: `Your availability doesn't match this suggestions time slot.` });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO votes (
        hangout_member_id,
        suggestion_id,
        hangout_id
      ) VALUES (${generatePlaceHolders(3)});`,
      [requestData.hangoutMemberId, requestData.suggestionId, requestData.hangoutId]
    );

    await connection.commit();
    res.status(201).json({ voteId: resultSetHeader.insertId });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });

  } finally {
    connection?.release();
  };
});

votesRouter.delete('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    voteId: number,
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

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'voteId'];
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

  if (!Number.isInteger(requestData.voteId)) {
    res.status(400).json({ message: 'Invalid vote ID.' });
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
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

    if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
      return;
    };

    interface HangoutMemberDetails extends RowDataPacket {
      is_concluded: boolean,
      current_stage: number,
      hangout_member_id: number
      account_id: number | null,
      guest_id: number | null,
      vote_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.is_concluded,
        hangouts.current_stage,
        hangout_members.account_id,
        hangout_members.guest_id,
        votes.vote_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        votes ON hangout_members.hangout_member_id = votes.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${HANGOUT_VOTES_LIMIT};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'guestHangoutId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.is_concluded) {
      res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });
      return;
    };

    if (hangoutMemberDetails.current_stage !== HANGOUT_VOTING_STAGE) {
      res.status(403).json({ message: `Hangout hasn't reached the voting stage yet.`, reason: 'inAvailabilityStage' });
      return;
    };

    const voteFound: boolean = hangoutMemberRows.find((vote: HangoutMemberDetails) => vote.vote_id === requestData.voteId) !== undefined;
    if (!voteFound) {
      res.status(404).json({ message: 'Vote not found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        votes
      WHERE
        vote_id = ?;`,
      [requestData.voteId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    res.json({});

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});

votesRouter.delete('/clear', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
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

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId'];
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
      removeRequestCookie(res, 'authSessionId');
      res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });

      return;
    };

    const authSessionDetails: AuthSessionDetails = authSessionRows[0];

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
      votes_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.is_concluded,
        hangouts.current_stage,
        hangout_members.account_id,
        hangout_members.guest_id,
        votes.vote_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        votes ON hangout_members.hangout_member_id = votes.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${HANGOUT_VOTES_LIMIT};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

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

    if (hangoutMemberDetails.current_stage !== HANGOUT_VOTING_STAGE) {
      res.status(403).json({ message: `Hangout hasn't reached the voting stage yet.`, reason: 'inAvailabilityStage' });
      return;
    };

    const votesFound: boolean = hangoutMemberRows.find((vote: HangoutMemberDetails) => vote.vote_id) !== undefined;
    if (!votesFound) {
      res.status(409).json({ message: 'No votes found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        votes
      WHERE
        hangout_member_id = ?;`,
      [requestData.hangoutMemberId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      return;
    };

    res.json({ votesDeleted: resultSetHeader.affectedRows });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});