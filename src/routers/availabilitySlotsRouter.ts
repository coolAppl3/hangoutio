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
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'slotStartTimestamp', 'slotEndTimestamp'];
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

  if (!availabilitySlotValidation.isValidAvailabilitySlot(requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
    res.status(400).json({ success: false, message: 'Invalid availability slot.' });
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
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutMemberDetails extends RowDataPacket {
      conclusion_timestamp: number,
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMemberDetails[]>(
      `SELECT
        hangouts.conclusion_timestamp,
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
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
      LIMIT ${availabilitySlotValidation.availabilitySlotsLimit};`,
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
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    if (hangoutMemberDetails.is_concluded) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Hangout already concluded.' });

      return;
    };

    if (!availabilitySlotValidation.isValidAvailabilitySlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.slotStartTimestamp)) {
      await connection.rollback();
      res.status(400).json({ success: false, message: 'Invalid availability slot.' });

      return;
    };

    interface ExistingAvailabilitySlot {
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const existingAvailabilitySlots: ExistingAvailabilitySlot[] = hangoutMemberRows.map((member: HangoutMemberDetails) => ({
      slot_start_timestamp: member.slot_start_timestamp,
      slot_end_timestamp: member.slot_end_timestamp,
    }));

    if (existingAvailabilitySlots.length >= availabilitySlotValidation.availabilitySlotsLimit) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Availability slots limit reached.' });

      return;
    };

    if (availabilitySlotValidation.intersectsWithExistingSlots(existingAvailabilitySlots, requestData)) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Availability slot intersection detected.' });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO availability_slots(
        hangout_member_id,
        hangout_id,
        slot_start_timestamp,
        slot_end_timestamp
      )
      VALUES(${generatePlaceHolders(4)});`,
      [requestData.hangoutMemberId, requestData.hangoutId, requestData.slotStartTimestamp, requestData.slotEndTimestamp]
    );

    await connection.commit();
    res.status(201).json({ success: true, resData: { availabilitySlotId: resultSetHeader.insertId } });

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
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
    return;
  };

  if (!authUtils.isValidAuthSessionId(authSessionId)) {
    removeRequestCookie(res, 'authSessionId', true);
    res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });

    return;
  };

  const requestData: RequestData = req.body;

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'availabilitySlotId', 'slotStartTimestamp', 'slotEndTimestamp'];
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

  if (!Number.isInteger(requestData.availabilitySlotId)) {
    res.status(400).json({ success: false, message: 'Invalid availability slot ID.' });
    return;
  };

  if (!availabilitySlotValidation.isValidAvailabilitySlot(requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
    res.status(400).json({ success: false, message: 'Invalid availability slot.' });
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
        hangouts.conclusion_timestamp,
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
      LIMIT ${availabilitySlotValidation.availabilitySlotsLimit};`,
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
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    if (hangoutMemberDetails.is_concluded) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Hangout already concluded.' });

      return;
    };

    if (!availabilitySlotValidation.isValidAvailabilitySlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.slotStartTimestamp)) {
      await connection.rollback();
      res.status(400).json({ success: false, message: 'Invalid availability slot.' });

      return;
    };

    if (!hangoutMemberDetails.availability_slot_id) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Availability slot not found.' });

      return;
    };

    interface ExistingAvailabilitySlot {
      availability_slot_id: number,
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const existingAvailabilitySlots: ExistingAvailabilitySlot[] = hangoutMemberRows.map((member: HangoutMemberDetails) => ({
      availability_slot_id: member.availability_slot_id,
      slot_start_timestamp: member.slot_start_timestamp,
      slot_end_timestamp: member.slot_end_timestamp,
    }));

    const slotToUpdate: ExistingAvailabilitySlot | undefined = existingAvailabilitySlots.find((slot: ExistingAvailabilitySlot) => slot.availability_slot_id === requestData.availabilitySlotId);
    if (!slotToUpdate) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Availability slot not found.' });

      return;
    };

    if (
      slotToUpdate.slot_start_timestamp === requestData.slotStartTimestamp &&
      slotToUpdate.slot_end_timestamp === requestData.slotEndTimestamp
    ) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'New availability slot is identical to existing slot.' });

      return;
    };

    const filteredExistingSlots: ExistingAvailabilitySlot[] = existingAvailabilitySlots.filter((slot: ExistingAvailabilitySlot) => slot.availability_slot_id !== requestData.availabilitySlotId);

    if (filteredExistingSlots.length === 0) {
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
        res.status(500).json({ success: false, message: 'Internal server error.' });

        return;
      };

      await connection.commit();
      res.json({ success: true, resData: {} });

      return;
    };

    if (availabilitySlotValidation.intersectsWithExistingSlots(filteredExistingSlots, requestData)) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Availability slot intersection detected.' });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `UPDATE
        availability_slot
      SET
        slot_start_timestamp = ?,
        slot_end_timestamp = ?
      WHERE
        availability_slot_id = ?;`,
      [requestData.slotStartTimestamp, requestData.slotEndTimestamp, requestData.availabilitySlotId]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: {} });

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

availabilitySlotsRouter.delete('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutId: string,
    hangoutMemberId: number,
    availabilitySlotId: number,
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

  const expectedKeys: string[] = ['hangoutId', 'hangoutMemberId', 'availabilitySlotId'];
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

  if (!Number.isInteger(requestData.availabilitySlotId)) {
    res.status(400).json({ success: false, message: 'Invalid availability slot ID.' });
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
      LIMIT ${availabilitySlotValidation.availabilitySlotsLimit};`,
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

    if (hangoutMemberDetails.is_concluded) {
      res.status(409).json({ success: false, message: 'Hangout already concluded.' });
      return;
    };

    if (!hangoutMemberDetails.availability_slot_id) {
      res.status(404).json({ success: false, message: 'Availability slot not found.' });
      return;
    };

    const slotFound: boolean = hangoutMemberRows.find((member: HangoutMemberDetails) => member.availability_slot_id === requestData.availabilitySlotId) !== undefined;
    if (!slotFound) {
      res.status(404).json({ success: false, message: 'Availability slot not found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        availability_slots
      WHERE
        availability_slot_id = ?;`,
      [requestData.availabilitySlotId]
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

availabilitySlotsRouter.delete('/clear', async (req: Request, res: Response) => {
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
      WHERe
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
      LIMIT ${availabilitySlotValidation.availabilitySlotsLimit};`,
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

    if (hangoutMemberDetails.is_concluded) {
      res.status(409).json({ success: false, message: 'Hangout already concluded.' });
      return;
    };

    if (!hangoutMemberDetails.availability_slot_id) {
      res.status(404).json({ success: false, message: 'No slots found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        availability_slots
      WHERE
        hangout_member_id = ?
      LIMIT ${availabilitySlotValidation.availabilitySlotsLimit};`,
      [requestData.hangoutMemberId]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: { deletedSlots: resultSetHeader.affectedRows } });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});