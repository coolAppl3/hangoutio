import { dbPool } from "../db/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import express, { Router, Request, Response } from "express";
import { isValidAuthToken } from "../util/validation/userValidation";
import { getUserId, getUserType } from "../util/userUtils";
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { isValidHangoutId } from "../util/validation/hangoutValidation";
import * as voteValidation from '../util/validation/voteValidation';
import { availabilitySlotsLimit } from "../util/validation/availabilitySlotValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";

export const votesRouter: Router = express.Router();

votesRouter.post('/', async (req: Request, res: Response) => {
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
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutMember extends RowDataPacket {
      current_step: number,
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
      suggestion_found: boolean,
      already_voted: boolean,
      total_votes: number,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMember[]>(
      `SELECT
        hangouts.current_step,
        hangout_members.account_id,
        hangout_members.guest_id,
        EXISTS (SELECT 1 FROM suggestions WHERE suggestion_id = ?) AS suggestion_found,
        EXISTS (SELECT 1 FROM votes WHERE hangout_member_id = ? AND suggestion_id = ?) AS already_voted,
        (SELECT COUNT(*) FROM votes WHERE hangout_member_id = ? LIMIT ?) AS total_votes
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT 1;`,
      [requestData.suggestionId, requestData.hangoutMemberId, requestData.suggestionId, requestData.hangoutMemberId, voteValidation.votesLimit, requestData.hangoutId, requestData.hangoutMemberId]
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userId) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    if (hangoutMember.current_step !== 3) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Not in voting step.' });

      return;
    };


    if (!hangoutMember.suggestion_found) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Suggestion not found.' });

      return;
    };

    if (hangoutMember.already_voted) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Already voted.' });

      return;
    };

    if (hangoutMember.total_votes >= voteValidation.votesLimit) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Vote limit reached.' });

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
      res.status(409).json({ success: false, message: 'No matching availability.' });

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
      res.status(409).json({ success: false, message: 'No matching availability.' });

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

votesRouter.delete('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    voteId: number,
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

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'voteId'];
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

  if (!Number.isInteger(requestData.voteId)) {
    res.status(400).json({ success: false, message: 'Invalid vote Id.' });
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
      current_step: number
      hangout_member_id: number
      account_id: number | null,
      guest_id: number | null,
      vote_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        hangouts.current_step,
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
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userId) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutMember.current_step !== 3) {
      res.status(409).json({ success: false, message: 'Not in voting step.' });
      return;
    };

    const voteFound: boolean = hangoutMemberRows.find((vote: HangoutMember) => vote.vote_id === requestData.voteId) !== undefined;
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
    res.status(400).json({ success: false, message: 'Invalid hangout member Id.' });
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
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      votes_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
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
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userId) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutMember.is_concluded) {
      res.status(409).json({ success: false, message: 'Hangout concluded.' });
      return;
    };

    const votesFound: boolean = hangoutMemberRows.find((vote: HangoutMember) => vote.vote_id) !== undefined;
    if (!votesFound) {
      res.status(409).json({ success: false, message: 'No votes to clear.' });
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