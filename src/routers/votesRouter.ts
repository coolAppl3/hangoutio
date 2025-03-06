import { dbPool } from "../db/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import express, { Router, Request, Response } from "express";
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { isValidHangoutId } from "../util/validation/hangoutValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import * as authUtils from '../auth/authUtils';
import { getRequestCookie, removeRequestCookie } from "../util/cookieUtils";
import { destroyAuthSession } from "../auth/authSessions";
import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_VOTES_LIMIT, HANGOUT_VOTING_STAGE } from "../util/constants";

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

    const authSessionDetails: AuthSessionDetails | undefined = authSessionRows[0]

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
        hangoutId: requestData.hangoutId,
        votesLimit: HANGOUT_VOTES_LIMIT,
      }
    );

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutMemberRows[0];

    if (!hangoutMemberDetails) {
      await connection.rollback();
      res.status(404).json({ message: 'Hangout not found.', reason: 'hangoutNotFound' });

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
      res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });
      return;
    };

    if (hangoutMemberDetails.current_stage !== HANGOUT_VOTING_STAGE) {
      res.status(403).json({
        message: `Hangout hasn't reached the voting stage yet.`,
        reason: hangoutMemberDetails.current_stage === HANGOUT_AVAILABILITY_STAGE ? 'inAvailabilityStage' : 'inSuggestionsStage',
      });

      return;
    };

    if (!hangoutMemberDetails.suggestion_found) {
      await connection.rollback();
      res.status(404).json({ message: 'Suggestion not found.', reason: 'suggestionNotFound' });

      return;
    };

    if (hangoutMemberDetails.already_voted) {
      await connection.rollback();
      res.json({});

      return;
    };

    if (hangoutMemberDetails.total_votes >= HANGOUT_VOTES_LIMIT) {
      await connection.rollback();
      res.status(409).json({ message: 'Votes limit reached.', reason: 'votesLimitReached' });

      return;
    };

    await connection.execute<ResultSetHeader>(
      `INSERT INTO votes (
        hangout_member_id,
        suggestion_id,
        hangout_id
      ) VALUES (${generatePlaceHolders(3)});`,
      [requestData.hangoutMemberId, requestData.suggestionId, requestData.hangoutId]
    );

    await connection.commit();
    res.status(201).json({});

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
      hangout_member_id: number
      account_id: number | null,
      guest_id: number | null,
      vote_id: number | null,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.is_concluded,
        hangouts.current_stage,
        hangout_members.account_id,
        hangout_members.guest_id,
        (SELECT vote_id FROM votes WHERE suggestion_id = :suggestionId AND hangout_member_id = :hangoutMemberId) AS vote_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = :hangoutId AND
        hangout_members.hangout_member_id = :hangoutMemberId
      LIMIT ${HANGOUT_VOTES_LIMIT};`,
      { suggestionId: +suggestionId, hangoutMemberId: +hangoutMemberId, hangoutId }
    );

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutMemberRows[0];

    if (!hangoutMemberDetails) {
      res.status(404).json({ message: 'Hangout not found.' });
      return;
    };

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
      res.status(403).json({
        message: `Hangout hasn't reached the voting stage yet.`,
        reason: hangoutMemberDetails.current_stage === HANGOUT_AVAILABILITY_STAGE ? 'inAvailabilityStage' : 'inSuggestionsStage',
      });

      return;
    };

    if (!hangoutMemberDetails.vote_id) {
      res.json({});
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        votes
      WHERE
        vote_id = ?;`,
      [hangoutMemberDetails.vote_id]
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