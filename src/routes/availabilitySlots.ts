import express, { Router, Request, Response } from 'express';
import { dbPool } from '../db/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { isValidAuthTokenString } from '../util/validation/userValidation';
import { getUserID, getUserType } from '../util/userUtils';
import { undefinedValuesDetected } from '../util/validation/requestValidation';
import { hangoutMemberLimit, isValidHangoutIDString } from '../util/validation/hangoutValidation';
import * as availabilitySlotsValidation from '../util/validation/availabilitySlotsValidation';
import { generatePlaceHolders } from '../util/generatePlaceHolders';

export const availabilitySlotsRouter: Router = express.Router();

availabilitySlotsRouter.post('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
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

  const expectedKeys: string[] = ['hangoutID', 'slotStartTimestamp', 'slotEndTimestamp'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (
    !availabilitySlotsValidation.isValidTimestamp(requestData.slotStartTimestamp) ||
    !availabilitySlotsValidation.isValidTimestamp(requestData.slotEndTimestamp)
  ) {
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

    interface HangoutDetails extends RowDataPacket {
      conclusion_timestamp: number,
      is_concluded: boolean,
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.conclusion_timestamp,
        hangouts.is_concluded,
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
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const memberDetails: HangoutDetails | undefined = hangoutRows.find((member: HangoutDetails) => member[`${userType}_id`] === userID);
    if (!memberDetails) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (hangoutDetails.is_concluded) {
      res.status(409).json({ success: false, message: 'Hangout concluded.' });
      return;
    };

    if (!availabilitySlotsValidation.isValidAvailabilitySlot(hangoutDetails.conclusion_timestamp, requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
      res.status(400).json({ success: false, message: 'Invalid slot.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface AvailabilitySlot extends RowDataPacket {
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const [availabilitySlotRows] = await connection.execute<AvailabilitySlot[]>(
      `SELECT
        slot_start_timestamp,
        slot_end_timestamp
      FROM
        availability_slots
      WHERE
        hangout_member_id = ?
      LIMIT ${availabilitySlotsValidation.availabilitySlotsLimit};`,
      [memberDetails.hangout_member_id]
    );

    if (availabilitySlotRows.length === 0) {
      const [resultSetHeader] = await connection.execute<ResultSetHeader>(
        `INSERT INTO availability_slots(
          hangout_member_id,
          hangout_id,
          slot_start_timestamp,
          slot_end_timestamp
        )
        VALUES(${generatePlaceHolders(3)});`,
        [memberDetails.hangout_member_id, requestData.hangoutID, requestData.slotStartTimestamp, requestData.slotEndTimestamp]
      );

      await connection.commit();
      res.json({ success: true, resData: { availabilitySlotID: resultSetHeader.insertId } });

      return;
    };

    if (availabilitySlotRows.length === availabilitySlotsValidation.availabilitySlotsLimit) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Availability slot limit reached.' });

      return;
    };

    if (availabilitySlotsValidation.intersectsWithExistingSlots(availabilitySlotRows, requestData)) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Slot intersection detected.' });

      return;
    };

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `INSERT INTO availability_slots(
        hangout_member_id,
        slot_start_timestamp,
        slot_end_timestamp
      )
      VALUES(${generatePlaceHolders(3)});`,
      [memberDetails.hangout_member_id, requestData.slotStartTimestamp, requestData.slotEndTimestamp]
    );

    await connection.commit();
    res.json({ success: true, resData: { availabilitySlotID: resultSetHeader.insertId } });

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

availabilitySlotsRouter.put('/', async (req: Request, res: Response) => {
  interface RequestData {
    hangoutID: string,
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

  const expectedKeys: string[] = ['hangoutID', 'availabilitySlotID', 'slotStartTimestamp', 'slotEndTimestamp'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
    return;
  };

  if (!isValidHangoutIDString(requestData.hangoutID)) {
    res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
    return;
  };

  if (!Number.isInteger(requestData.availabilitySlotID)) {
    res.status(400).json({ success: false, message: 'Invalid availability slot ID.' });
    return;
  };

  if (
    !availabilitySlotsValidation.isValidTimestamp(requestData.slotStartTimestamp) ||
    !availabilitySlotsValidation.isValidTimestamp(requestData.slotEndTimestamp)
  ) {
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

    interface HangoutDetails extends RowDataPacket {
      conclusion_timestamp: number,
      is_concluded: boolean,
      hangout_member_id: number,
      account_id: number | null,
      guest_id: number | null,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.conclusion_timestamp,
        hangouts.is_concluded,
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
      res.status(404).json({ success: false, message: 'Hangout not found.' });
      return;
    };

    const memberDetails: HangoutDetails | undefined = hangoutRows.find((member: HangoutDetails) => member[`${userType}_id`] === userID);
    if (!memberDetails) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const hangoutDetails: HangoutDetails = hangoutRows[0];

    if (hangoutDetails.is_concluded) {
      res.status(409).json({ success: false, message: 'Hangout concluded.' });
      return;
    };

    if (!availabilitySlotsValidation.isValidAvailabilitySlot(hangoutDetails.conclusion_timestamp, requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
      res.status(400).json({ success: false, message: 'Invalid slot.' });
      return;
    };

    connection = await dbPool.getConnection();
    await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
    await connection.beginTransaction();

    interface AvailabilitySlot extends RowDataPacket {
      availability_slot_id: number,
      slot_start_timestamp: number,
      slot_end_timestamp: number,
    };

    const [availabilitySlotRows] = await connection.execute<AvailabilitySlot[]>(
      `SELECT
        availability_slot_id,
        slot_start_timestamp,
        slot_end_timestamp
      FROM
        availability_slots
      WHERE
        hangout_member_id = ?
      LIMIT ${availabilitySlotsValidation.availabilitySlotsLimit};`,
      [memberDetails.hangout_member_id]
    );

    if (availabilitySlotRows.length === 0) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Slot not found.' });

      return;
    };

    const slotToUpdate: AvailabilitySlot | undefined = availabilitySlotRows.find((slot: AvailabilitySlot) => slot.availability_slot_id === requestData.availabilitySlotID);
    if (!slotToUpdate) {
      await connection.rollback();
      res.status(404).json({ success: false, message: 'Slot not found.' });

      return;
    };

    if (
      slotToUpdate.slot_start_timestamp === requestData.slotStartTimestamp &&
      slotToUpdate.slot_end_timestamp === requestData.slotStartTimestamp
    ) {
      await connection.rollback();
      res.status(409).json({ success: false, message: 'Slot identical.' });

      return;
    };

    const filteredExistingSlots: AvailabilitySlot[] = availabilitySlotRows.filter((slot: AvailabilitySlot) => slot.availability_slot_id !== requestData.availabilitySlotID);

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

    if (availabilitySlotsValidation.intersectsWithExistingSlots(filteredExistingSlots, requestData)) {
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
    res.json({ success: true, resData: {} })

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

  const expectedKeys: string[] = ['hangoutMemberID', 'availabilitySlotID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
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

    interface AvailabilitySlot extends RowDataPacket {
      account_id: number | null,
      guest_id: number | null,
      availability_slot_id: number,
    };

    const [availabilitySlotRows] = await dbPool.execute<AvailabilitySlot[]>(
      `SELECT
        hangout_members.account_id,
        hangout_members.guest_id,
        availability_slots.availability_slot_id
      FROM
        hangout_members
      LEFT JOIN
        availability_slots ON hangout_members.hangout_member_id = availability_slots.hangout_member_id
      WHERE
        hangout_members.hangout_member_id = ?
      LIMIT ${availabilitySlotsValidation.availabilitySlotsLimit};`,
      [requestData.hangoutMemberID]
    );

    if (availabilitySlotRows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    if (availabilitySlotRows[0][`${userType}_id`] !== userID) {
      res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
      return;
    };

    const slotToDelete: AvailabilitySlot | undefined = availabilitySlotRows.find((slot: AvailabilitySlot) => slot.availability_slot_id === requestData.availabilitySlotID);
    if (!slotToDelete) {
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

  const expectedKeys: string[] = ['hangoutMemberID'];
  if (undefinedValuesDetected(requestData, expectedKeys)) {
    res.status(400).json({ success: false, message: 'Invalid request data.' });
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
      account_id: number,
      guest_id: number,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        account_id,
        guest_id
      FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`,
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

    const [resultSetHeader] = await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        availability_slots
      WHERE
        hangout_member_id = ?;`,
      [requestData.hangoutMemberID]
    );

    res.json({ success: true, resData: { slotsDeleted: resultSetHeader.affectedRows } })

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  };
});