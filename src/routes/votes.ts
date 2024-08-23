import { dbPool } from "../db/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import express, { Router, Request, Response } from "express";
import { isValidAuthTokenString } from "../util/validation/userValidation";
import { getUserID, getUserType } from "../util/userUtils";
import { undefinedValuesDetected } from "../util/validation/requestValidation";
import { hangoutMemberLimit, isValidHangoutIDString } from "../util/validation/hangoutValidation";
import * as voteValidation from '../util/validation/voteValidation';
import { availabilitySlotsLimit } from "../util/validation/availabilitySlotValidation";
import { generatePlaceHolders } from "../util/generatePlaceHolders";

export const votesRouter: Router = express.Router();

votesRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
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

  const expectedKeys: string[] = ['hangoutID', 'hangoutMemberID', 'suggestionID'];
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

  if (!Number.isInteger(requestData.suggestionID)) {
    res.status(400).json({ success: false, message: 'Invalid suggestion ID.' });
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
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
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
      res.status(400).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const isMember: boolean = hangoutRows.find((member: HangoutDetails) => member.hangout_member_id === requestData.hangoutMemberID && member[`${userType}_id`] === userID) !== undefined;
    if (!isMember) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutRows[0].current_step !== 3) {
      res.status(409).json({ success: false, message: 'Not in voting step.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface MemberVotes extends RowDataPacket {
      suggestion_found: boolean,
      already_voted: boolean,
      total_votes: number,
    };

    const [memberVotesRows] = await connection.execute<MemberVotes[]>(
      `SELECT
        EXISTS (SELECT 1 FROM suggestions WHERE suggestion_id = ? AND hangout_id = ?) AS suggestion_found,
        EXISTS (SELECT 1 FROM votes WHERE hangout_member_id = ? AND suggestion_id = ?) as already_voted,
        (SELECT COUNT(*) FROM votes WHERE hangout_member_id = ?) AS total_votes
      ;`,
      [requestData.suggestionID, requestData.hangoutID, requestData.hangoutMemberID, requestData.suggestionID, requestData.hangoutID]
    );

    const memberVotes: MemberVotes = memberVotesRows[0];

    if (!memberVotes.suggestion_found) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Suggestion not found.' });

      return;
    };

    if (memberVotes.already_voted) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Already voted.' });

      return;
    };

    if (memberVotes.total_votes >= voteValidation.votesLimit) {
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
      [requestData.suggestionID, requestData.hangoutMemberID]
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
      [requestData.hangoutMemberID, requestData.suggestionID, requestData.hangoutID]
    );

    await connection.commit();
    res.json({ success: true, resData: { voteID: resultSetHeader.insertId } })

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

votesRouter.delete('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutMemberID: number,
    voteID: number,
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

  const expectedKeys: string[] = ['hangoutMemberID', 'voteID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.voteID)) {
    res.status(400).json({ success: false, message: 'Invalid vote ID.' });
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

    interface HangoutMember extends RowDataPacket {
      account_id: number,
      guest_id: number,
      vote_id: number | null,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        hangout_members.account_id,
        hangout_members.guest_id,
        votes.vote_id
      FROM
        hangout_members
      LEFT JOIN
        votes ON hangout_members.hangout_member_id = votes.hangout_member_id
      WHERE
        hangout_members.hangout_member_id = ?
      LIMIT ${voteValidation.votesLimit};`,
      [requestData.hangoutMemberID]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutMemberRows[0][`${userType}_id`] !== userID) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const voteFound: boolean = hangoutMemberRows.find((member: HangoutMember) => member.vote_id === requestData.voteID) !== undefined;
    if (!voteFound) {
      res.status(404).json({ success: false, message: 'Vote not found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        votes
      WHERE
        vote_id = ?;`,
      [requestData.voteID]
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