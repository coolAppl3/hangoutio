import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { isValidAuthTokenString } from '../util/validation/userValidation';
import { getUserID, getUserType } from '../util/userUtils';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { isValidHangoutID } from '../util/validation/hangoutValidation';
import * as availabilitySlotValidation from '../util/validation/availabilitySlotValidation';
import { generatePlaceHolders } from '../util/generatePlaceHolders';

export const availabilitySlotsRouter: Router = express.Router();

availabilitySlotsRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutMemberID: number,
    slotStartTimestamp: number,
    slotEndTimestamp: number,
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

  const expectedKeys: string[] = ['hangoutID', 'hangoutMemberID', 'slotStartTimestamp', 'slotEndTimestamp'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutID(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!availabilitySlotValidation.isValidAvailabilitySlot(requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
    res.status(400).json({ success: false, message: 'Invalid slot.' });
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

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutMember extends RowDataPacket {
      conclusion_timestamp: number,
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const [hangoutMemberRows] = await connection.execute<HangoutMember[]>(
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
      [requestData.hangoutID, requestData.hangoutMemberID]
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userID) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    if (hangoutMember.is_concluded) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Hangout concluded.' });

      return;
    };

    if (!availabilitySlotValidation.isValidAvailabilitySlotStart(hangoutMember.conclusion_timestamp, requestData.slotStartTimestamp)) {
      await connection.rollback();
      res.status(400).json({ success: false, message: 'Invalid slot.' });

      return;
    };

    interface ExistingAvailabilitySlot {
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const existingAvailabilitySlots: ExistingAvailabilitySlot[] = hangoutMemberRows.map((member: HangoutMember) => ({
      slot_start_timestamp: member.slot_start_timestamp,
      slot_end_timestamp: member.slot_end_timestamp,
    }));

    if (existingAvailabilitySlots.length >= availabilitySlotValidation.availabilitySlotsLimit) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Availability slot limit reached.' });

      return;
    };

    if (availabilitySlotValidation.intersectsWithExistingSlots(existingAvailabilitySlots, requestData)) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Slot intersection detected.' });

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
      [requestData.hangoutMemberID, requestData.hangoutID, requestData.slotStartTimestamp, requestData.slotEndTimestamp]
    );

    await connection.commit();
    res.status(201).json({ success: true, resData: { availabilitySlotID: resultSetHeader.insertId } });

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

availabilitySlotsRouter.patch('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutMemberID: number,
    availabilitySlotID: number,
    slotStartTimestamp: number,
    slotEndTimestamp: number,
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

  const expectedKeys: string[] = ['hangoutID', 'hangoutMemberID', 'availabilitySlotID', 'slotStartTimestamp', 'slotEndTimestamp'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutID(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.availabilitySlotID)) {
    res.status(400).json({ success: false, message: 'Invalid availability slot ID.' });
    return;
  };

  if (!availabilitySlotValidation.isValidAvailabilitySlot(requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
    res.status(400).json({ success: false, message: 'Invalid slot.' });
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

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface HangoutMember extends RowDataPacket {
      conclusion_timestamp: number,
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      availability_slot_id: number,
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
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
      [requestData.hangoutID, requestData.hangoutMemberID]
    );

    if (hangoutMemberRows.length === 0) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userID) {
      await connection.rollback();
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });

      return;
    };

    if (hangoutMember.is_concluded) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Hangout concluded.' });

      return;
    };

    if (!availabilitySlotValidation.isValidAvailabilitySlotStart(hangoutMember.conclusion_timestamp, requestData.slotStartTimestamp)) {
      await connection.rollback();
      res.status(400).json({ success: false, message: 'Invalid slot.' });

      return;
    };

    if (!hangoutMember.availability_slot_id) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Slot not found.' });

      return;
    };

    interface ExistingAvailabilitySlot {
      availability_slot_id: number,
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const existingAvailabilitySlots: ExistingAvailabilitySlot[] = hangoutMemberRows.map((member: HangoutMember) => ({
      availability_slot_id: member.availability_slot_id,
      slot_start_timestamp: member.slot_start_timestamp,
      slot_end_timestamp: member.slot_end_timestamp,
    }));

    const slotToUpdate: ExistingAvailabilitySlot | undefined = existingAvailabilitySlots.find((slot: ExistingAvailabilitySlot) => slot.availability_slot_id === requestData.availabilitySlotID);
    if (!slotToUpdate) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Slot not found.' });

      return;
    };

    if (
      slotToUpdate.slot_start_timestamp === requestData.slotStartTimestamp &&
      slotToUpdate.slot_end_timestamp === requestData.slotEndTimestamp
    ) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Slot identical.' });

      return;
    };

    const filteredExistingSlots: ExistingAvailabilitySlot[] = existingAvailabilitySlots.filter((slot: ExistingAvailabilitySlot) => slot.availability_slot_id !== requestData.availabilitySlotID);

    if (filteredExistingSlots.length === 0) {
      const [resultSetHeader] = await connection.execute<ResultSetHeader>(
        `UPDATE
          availability_slots
        SET
          slot_start_timestamp = ?,
          slot_end_timestamp = ?
        WHERE
          availability_slot_id = ?;`,
        [requestData.slotStartTimestamp, requestData.slotEndTimestamp, requestData.availabilitySlotID]
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
      res.status(409).json({ success: false, message: 'Slot intersection detected.' });

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
      [requestData.slotStartTimestamp, requestData.slotEndTimestamp, requestData.availabilitySlotID]
    );

    if (resultSetHeader.affectedRows === 0) {
      await connection.rollback();
      res.status(500).json({ success: false, message: 'Internal server error.' });

      return;
    };

    await connection.commit();
    res.json({ success: true, resData: {} });

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

availabilitySlotsRouter.delete('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutMemberID: number,
    availabilitySlotID: number,
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

  const expectedKeys: string[] = ['hangoutID', 'hangoutMemberID', 'availabilitySlotID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutID(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
    return;
  };

  if (!Number.isInteger(requestData.availabilitySlotID)) {
    res.status(400).json({ success: false, message: 'Invalid slot ID.' });
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
      is_concluded: boolean,
      account_id: number | null,
      guest_id: number | null,
      availability_slot_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
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
      [requestData.hangoutID, requestData.hangoutMemberID]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userID) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutMember.is_concluded) {
      res.status(409).json({ success: false, message: 'Hangout concluded.' });
      return;
    };

    if (!hangoutMember.availability_slot_id) {
      res.status(404).json({ success: false, message: 'Slot not found.' });
      return;
    };

    const slotFound: boolean = hangoutMemberRows.find((member: HangoutMember) => member.availability_slot_id === requestData.availabilitySlotID) !== undefined;
    if (!slotFound) {
      res.status(404).json({ success: false, message: 'Slot not found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        availability_slots
      WHERE
        availability_slot_id = ?;`,
      [requestData.availabilitySlotID]
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

availabilitySlotsRouter.delete('/clear', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
    hangoutMemberID: number,
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

  const expectedKeys: string[] = ['hangoutID', 'hangoutMemberID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutID(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.hangoutMemberID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
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
      is_concluded: boolean,
      account_id: number,
      guest_id: number,
      availability_slot_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
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
      [requestData.hangoutID, requestData.hangoutMemberID]
    );

    if (hangoutMemberRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutMember: HangoutMember = hangoutMemberRows[0];

    if (hangoutMember[`${userType}_id`] !== userID) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (hangoutMember.is_concluded) {
      res.status(409).json({ success: false, message: 'Hangout concluded.' });
      return;
    };

    if (!hangoutMember.availability_slot_id) {
      res.status(404).json({ success: false, message: 'No slots found.' });
      return;
    };

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        availability_slots
      WHERE
        hangout_member_id = ?
      LIMIT ${availabilitySlotValidation.availabilitySlotsLimit};`,
      [requestData.hangoutMemberID]
    );

    if (resultSetHeader.affectedRows === 0) {
      res.status(500).json({ success: false, message: 'Internal server error.' });
      return;
    };

    res.json({ success: true, resData: { deletedSlots: resultSetHeader.affectedRows } });

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});