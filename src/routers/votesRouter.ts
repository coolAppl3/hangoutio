import { dbPool } from "../db/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import express, { Router, Request, Response } from "express";
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { isValidHangoutId } from "../util/validation/hangoutValidation";
import * as voteValidation from '../util/validation/voteValidation';
import { availabilitySlotsLimit } from "../util/validation/availabilitySlotValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import * as authUtils from '../auth/authUtils';
import { getRequestCookie, removeRequestCookie } from "../util/cookieUtils";
import { destroyAuthSession } from "../auth/authSessions";

export const votesRouter: Router = express.Router();

votesRouter.post('/', async (req: Request, res: Response) => {
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
      { authSessionId }
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
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutMemberDetails extends RowDataPacket {
      current_step: number,
      is_concluded: boolean,
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_found: boolean,
      already_voted: boolean,
      total_votes: number,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.current_step,
        hangouts.is_concluded,
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
        votesLimit: voteValidation.votesLimit
      }
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
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    if (hangoutMemberDetails.current_step !== 3) {
      await connection.rollback();
      res.status(409).json({
        success: false,
        message: hangoutMemberDetails.is_concluded ? 'Hangout already concluded' : `Hangout isn't in the voting stage.`,
      });

      return;
    };

    if (!hangoutMemberDetails.suggestion_found) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Suggestion not found.' });

      return;
    };

    if (hangoutMemberDetails.already_voted) {
      await connection.rollback();
      res.status(409).json({ success: false, message: `You've already voted for this suggestion.` });

      return;
    };

    if (hangoutMemberDetails.total_votes >= voteValidation.votesLimit) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Votes limit reached.' });

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
      LIMIT ${availabilitySlotsLimit};`,
      [requestData.suggestionId, requestData.hangoutMemberId]
    );

    if (suggestionAvailabilityRows.length === 0) {
      await connection.rollback();
      res.status(409).json({ success: false, message: `Your availability doesn't match this suggestions time slot.` });

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
      res.status(409).json({ success: false, message: `Your availability doesn't match this suggestions time slot.` });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO votes(
        hangout_member_id,
        suggestion_id,
        hangout_id
      )
      VALUES(${generatePlaceHolders(3)});`,
      [requestData.hangoutMemberId, requestData.suggestionId, requestData.hangoutId]
    );

    await connection.commit();
    res.status(201).json({ success: true, resData: { voteId: resultSetHeader.insertId } });

  } catch (err: unknown) {
    console.log(err);
    await connection?.rollback();

    res.status(500).json({ success: false, message: 'Internal server error.' });

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
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'voteId'];
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

  if (!Number.isInteger(requestData.voteId)) {
    res.status(400).json({ success: false, message: 'Invalid vote ID.' });
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
      { authSessionId }
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
      current_step: number,
      is_concluded: boolean,
      hangout_member_id: number
      account_id: number | null,
      guest_id: number | null,
      vote_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.current_step,
        hangouts.is_concluded,
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
      LIMIT ${voteValidation.votesLimit};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const hangoutMemberDetails: HangoutMemberDetails = hangoutMemberRows[0];

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'guestHangoutId', true);

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutMemberDetails.current_step !== 3) {
      res.status(409).json({
        success: false,
        message: hangoutMemberDetails.is_concluded ? 'Hangout already concluded' : `Hangout isn't in the voting stage.`,
      });

      return;
    };

    const voteFound: boolean = hangoutMemberRows.find((vote: HangoutMemberDetails) => vote.vote_id === requestData.voteId) !== undefined;
    if (!voteFound) {
      res.status(404).json({ success: false, message: 'Vote not found.' });
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
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: {} });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});

votesRouter.delete('/clear', async (req: Request, res: Response) => {
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
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
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
      { authSessionId }
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
      current_step: number,
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      votes_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.current_step,
        hangouts.is_concluded,
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
      LIMIT ${voteValidation.votesLimit};`,
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

      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutMemberDetails.current_step !== 3) {
      res.status(409).json({
        success: false,
        message: hangoutMemberDetails.is_concluded ? 'Hangout already concluded' : `Hangout isn't in the voting stage.`,
      });

      return;
    };

    const votesFound: boolean = hangoutMemberRows.find((vote: HangoutMemberDetails) => vote.vote_id) !== undefined;
    if (!votesFound) {
      res.status(409).json({ success: false, message: 'No votes found.' });
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
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: { votesDeleted: resultSetHeader.affectedRows } });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});