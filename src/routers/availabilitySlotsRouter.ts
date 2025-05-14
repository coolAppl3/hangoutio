import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { isValidHangoutId } from '../util/validation/hangoutValidation';
import * as availabilitySlotValidation from '../util/validation/availabilitySlotValidation';
import { generatePlaceHolders } from '../util/generatePlaceHolders';
import { getRequestCookie, removeRequestCookie } from '../util/cookieUtils';
import * as authUtils from '../auth/authUtils';
import { destroyAuthSession } from '../auth/authSessions';
import { HANGOUT_AVAILABILITY_SLOTS_LIMIT, MAX_HANGOUT_MEMBERS_LIMIT } from '../util/constants';
import { AvailabilitySlot } from '../util/hangoutTypes';
import { sendHangoutWebSocketMessage } from '../webSockets/hangout/hangoutWebSocketServer';
import { logUnexpectedError } from '../logs/errorLogger';

export const availabilitySlotsRouter: Router = express.Router();

availabilitySlotsRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    slotStartTimestamp: number,
    slotEndTimestamp: number,
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

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'slotStartTimestamp', 'slotEndTimestamp'];
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

  if (!availabilitySlotValidation.isValidAvailabilitySlot(requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
    res.status(400).json({ message: 'Invalid availability slot.', reason: 'invalidSlot' });
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
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutMemberDetails extends RowDataPacket {
      conclusion_timestamp: number,
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      availability_slot_id: number,
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMemberDetails[]>(
      `SELECT
        (
          hangouts.created_on_timestamp + hangouts.availability_period + hangouts.suggestions_period + hangouts.voting_period
        ) AS conclusion_timestamp,
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        availability_slots.availability_slot_id,
        availability_slots.slot_start_timestamp,
        availability_slots.slot_end_timestamp
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        availability_slots ON hangout_members.hangout_member_id = availability_slots.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${HANGOUT_AVAILABILITY_SLOTS_LIMIT};`,
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
      res.status(403).json({ message: 'Hangout has already been concluded.' });

      return;
    };

    if (!availabilitySlotValidation.isValidAvailabilitySlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.slotStartTimestamp)) {
      await connection.rollback();
      res.status(409).json({ message: 'Invalid availability slot start date and time.', reason: 'invalidStart' });

      return;
    };

    const existingAvailabilitySlots: AvailabilitySlot[] = hangoutMemberRows.map((member: HangoutMemberDetails) => ({
      availability_slot_id: member.availability_slot_id,
      hangout_member_id: requestData.hangoutMemberId,
      slot_start_timestamp: member.slot_start_timestamp,
      slot_end_timestamp: member.slot_end_timestamp,
    }));

    if (existingAvailabilitySlots.length >= HANGOUT_AVAILABILITY_SLOTS_LIMIT) {
      await connection.rollback();
      res.status(409).json({
        message: `Availability slots limit of ${HANGOUT_AVAILABILITY_SLOTS_LIMIT} reached.`, reason: 'slotLimitReached',
      });

      return;
    };

    const { slotStartTimestamp, slotEndTimestamp } = requestData;
    const overlappedSlot: AvailabilitySlot | null = availabilitySlotValidation.overlapsWithExistingAvailabilitySlots(existingAvailabilitySlots, { slotStartTimestamp, slotEndTimestamp });

    if (overlappedSlot) {
      await connection.rollback();
      res.status(409).json({
        message: 'Overlap detected.',
        reason: 'slotOverlap',
        resData: {
          overlappedSlotId: overlappedSlot.availability_slot_id,
        },
      });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO availability_slots (
        hangout_member_id,
        hangout_id,
        slot_start_timestamp,
        slot_end_timestamp
      ) VALUES (${generatePlaceHolders(4)});`,
      [requestData.hangoutMemberId, requestData.hangoutId, requestData.slotStartTimestamp, requestData.slotEndTimestamp]
    );

    await connection.commit();
    res.status(201).json({ availabilitySlotId: resultSetHeader.insertId });

    sendHangoutWebSocketMessage([requestData.hangoutId], {
      type: 'availabilitySlot',
      reason: 'newSlot',
      data: {
        newAvailabilitySlot: {
          availability_slot_id: resultSetHeader.insertId,
          hangout_member_id: requestData.hangoutMemberId,
          slot_start_timestamp: requestData.slotStartTimestamp,
          slot_end_timestamp: requestData.slotEndTimestamp,
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

availabilitySlotsRouter.patch('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    availabilitySlotId: number,
    slotStartTimestamp: number,
    slotEndTimestamp: number,
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

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'availabilitySlotId', 'slotStartTimestamp', 'slotEndTimestamp'];
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

  if (!Number.isInteger(requestData.availabilitySlotId)) {
    res.status(400).json({ message: 'Invalid availability slot ID.' });
    return;
  };

  if (!availabilitySlotValidation.isValidAvailabilitySlot(requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
    res.status(400).json({ message: 'Invalid availability slot.', reason: 'invalidSlot' });
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
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutMemberDetails extends RowDataPacket {
      conclusion_timestamp: number,
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      availability_slot_id: number,
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMemberDetails[]>(
      `SELECT
        (
          hangouts.created_on_timestamp + hangouts.availability_period + hangouts.suggestions_period + hangouts.voting_period
        ) AS conclusion_timestamp,
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        availability_slots.availability_slot_id,
        availability_slots.slot_start_timestamp,
        availability_slots.slot_end_timestamp
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        availability_slots ON hangout_members.hangout_member_id = availability_slots.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${HANGOUT_AVAILABILITY_SLOTS_LIMIT};`,
      [requestData.hangoutId, requestData.hangoutMemberId]
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
      await connection.rollback();
      res.status(403).json({ message: `Hangout has already been concluded.` });

      return;
    };

    let existingAvailabilitySlots: AvailabilitySlot[] = hangoutMemberRows.map((slot: HangoutMemberDetails) => ({
      availability_slot_id: slot.availability_slot_id,
      hangout_member_id: requestData.hangoutMemberId,
      slot_start_timestamp: slot.slot_start_timestamp,
      slot_end_timestamp: slot.slot_end_timestamp,
    }));

    const slotToEdit: AvailabilitySlot | undefined = existingAvailabilitySlots.find((slot: AvailabilitySlot) => slot.availability_slot_id === requestData.availabilitySlotId);

    if (!slotToEdit) {
      await connection.rollback();
      res.status(404).json({ message: 'Availability slot not found.', reason: 'slotNotFound' });

      return;
    };

    if (
      slotToEdit.slot_start_timestamp === requestData.slotStartTimestamp &&
      slotToEdit.slot_end_timestamp === requestData.slotEndTimestamp
    ) {
      await connection.rollback();
      res.status(409).json({ message: 'Slot already starts and ends at this date and time.', reason: 'slotsIdentical' });

      return;
    };

    if (!availabilitySlotValidation.isValidAvailabilitySlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.slotStartTimestamp)) {
      await connection.rollback();
      res.status(409).json({ message: 'Invalid slot start.', reason: 'invalidStart' });

      return;
    };

    existingAvailabilitySlots = existingAvailabilitySlots.filter((slot: AvailabilitySlot) => slot.availability_slot_id !== requestData.availabilitySlotId);

    const overlappedSlot: AvailabilitySlot | null = availabilitySlotValidation.overlapsWithExistingAvailabilitySlots(existingAvailabilitySlots, {
      slotStartTimestamp: requestData.slotStartTimestamp,
      slotEndTimestamp: requestData.slotEndTimestamp,
    });

    if (overlappedSlot) {
      await connection.rollback();
      res.status(409).json({
        message: 'Slot overlap detected.',
        reason: 'slotOverlap',
        resData: {
          overlappedSlotId: overlappedSlot.availability_slot_id,
        },
      });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        availability_slots
      SET
        slot_start_timestamp = ?,
        slot_end_timestamp = ?
      WHERE
        availability_slot_id = ?;`,
      [requestData.slotStartTimestamp, requestData.slotEndTimestamp, requestData.availabilitySlotId]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();

      res.status(500).json({ message: 'Internal server error.' });
      await logUnexpectedError(req, { message: 'Failed to update rows.', trace: null });

      return;
    };

    await connection.commit();
    res.json({});

    sendHangoutWebSocketMessage([requestData.hangoutId], {
      type: 'availabilitySlot',
      reason: 'slotUpdated',
      data: {
        updatedAvailabilitySlot: {
          availability_slot_id: requestData.availabilitySlotId,
          hangout_member_id: requestData.hangoutMemberId,
          slot_start_timestamp: requestData.slotStartTimestamp,
          slot_end_timestamp: requestData.slotEndTimestamp,
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

availabilitySlotsRouter.delete('/', async (req: Request, res: Response) => {
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
  const availabilitySlotId = req.query.availabilitySlotId;

  if (typeof hangoutId !== 'string' || typeof hangoutMemberId !== 'string' || typeof availabilitySlotId !== 'string') {
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

  if (!Number.isInteger(+availabilitySlotId)) {
    res.status(400).json({ message: 'Invalid availability slot ID.' });
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
      account_id: number | null,
      guest_id: number | null,
      availability_slot_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        availability_slots.availability_slot_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        availability_slots ON hangout_members.hangout_member_id = availability_slots.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${HANGOUT_AVAILABILITY_SLOTS_LIMIT};`,
      [hangoutId, +hangoutMemberId]
    );

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutMemberRows[0];

    if (!hangoutMemberDetails) {
      res.status(404).json({ message: 'Hangout not found.', reason: 'hangoutNotFound' });
      return;
    };

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.is_concluded) {
      res.status(403).json({ message: 'Hangout has already been concluded.' });
      return;
    };

    const slotFound: boolean = hangoutMemberRows.find((member: HangoutMemberDetails) => member.availability_slot_id === +availabilitySlotId) !== undefined;
    if (!slotFound) {
      res.status(404).json({ message: 'Availability slot not found.', reason: 'slotNotFound' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        availability_slots
      WHERE
        availability_slot_id = ?;`,
      [+availabilitySlotId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      await logUnexpectedError(req, { message: 'Failed to delete rows.', trace: null });

      return;
    };

    res.json({});

    sendHangoutWebSocketMessage([hangoutId], {
      type: 'availabilitySlot',
      reason: 'slotDeleted',
      data: {
        hangoutMemberId: +hangoutMemberId,
        deletedSlotId: +availabilitySlotId,
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

availabilitySlotsRouter.delete('/clear', async (req: Request, res: Response) => {
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
      WHERe
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
      account_id: number,
      guest_id: number,
      availability_slot_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        availability_slots.availability_slot_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        availability_slots ON hangout_members.hangout_member_id = availability_slots.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${HANGOUT_AVAILABILITY_SLOTS_LIMIT};`,
      [hangoutId, +hangoutMemberId]
    );

    const hangoutMemberDetails: HangoutMemberDetails | undefined = hangoutMemberRows[0];

    if (!hangoutMemberDetails) {
      res.status(404).json({ message: 'Hangout not found.', reason: 'hangoutNotFound' });
      return;
    };

    if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
      await destroyAuthSession(authSessionId);
      removeRequestCookie(res, 'authSessionId');

      res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
      return;
    };

    if (hangoutMemberDetails.is_concluded) {
      res.status(403).json({ message: 'Hangout has already been concluded.' });
      return;
    };

    if (!hangoutMemberDetails.availability_slot_id) {
      res.status(404).json({ message: 'No slots found.', reason: 'noSlotsFound' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        availability_slots
      WHERE
        hangout_member_id = ?
      LIMIT ${HANGOUT_AVAILABILITY_SLOTS_LIMIT};`,
      [+hangoutMemberId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ message: 'Internal server error.' });
      await logUnexpectedError(req, { message: 'Failed to delete rows.', trace: null });

      return;
    };

    res.json({ deletedSlots: resultSetHeader.affectedRows });

    sendHangoutWebSocketMessage([hangoutId], {
      type: 'availabilitySlot',
      reason: 'slotsCleared',
      data: {
        hangoutMemberId: +hangoutMemberId,
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

availabilitySlotsRouter.get('/', async (req: Request, res: Response) => {
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
      res.status(401).json({ message: 'Not a member of this hangout.', reason: 'notHangoutMember' });
      return;
    };

    interface AvailabilitySlot extends RowDataPacket {
      availability_slot_id: number,
      hangout_member_id: number,
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const [availabilitySlotRows] = await dbPool.execute<AvailabilitySlot[]>(
      `SELECT
        availability_slot_id,
        hangout_member_id,
        slot_start_timestamp,
        slot_end_timestamp
      FROM
        availability_slots
      WHERE
        hangout_id = ?
      ORDER BY
        slot_start_timestamp ASC
      LIMIT ${MAX_HANGOUT_MEMBERS_LIMIT * HANGOUT_AVAILABILITY_SLOTS_LIMIT};`,
      [hangoutId]
    );

    res.json({ availabilitySlots: availabilitySlotRows });

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
    await logUnexpectedError(req, err);
  };
});