"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilitySlotsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const userValidation_1 = require("../util/validation/userValidation");
const userUtils_1 = require("../util/userUtils");
const requestValidation_1 = require("../util/validation/requestValidation");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const availabilitySlotsValidation = __importStar(require("../util/validation/availabilitySlotsValidation"));
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
exports.availabilitySlotsRouter = express_1.default.Router();
exports.availabilitySlotsRouter.post('/', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const userID = (0, userUtils_1.getUserID)(authToken);
    const requestData = req.body;
    const expectedKeys = ['hangoutID', 'hangoutMemberID', 'slotStartTimestamp', 'slotEndTimestamp'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutIDString)(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!availabilitySlotsValidation.isValidTimestamp(requestData.slotStartTimestamp) ||
        !availabilitySlotsValidation.isValidTimestamp(requestData.slotEndTimestamp)) {
        res.status(400).json({ success: false, message: 'Invalid slot.' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const userType = (0, userUtils_1.getUserType)(authToken);
        const [userRows] = await db_1.dbPool.execute(`SELECT
        auth_token
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`, [userID]);
        if (userRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (authToken !== userRows[0].auth_token) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
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
      LIMIT ${hangoutValidation_1.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const memberDetails = hangoutRows.find((member) => member.hangout_member_id === requestData.hangoutMemberID);
        if (!memberDetails) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (memberDetails[`${userType}_id`] !== userID) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails.is_concluded) {
            res.status(409).json({ success: false, message: 'Hangout concluded.' });
            return;
        }
        ;
        if (!availabilitySlotsValidation.isValidAvailabilitySlot(hangoutDetails.conclusion_timestamp, requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
            res.status(400).json({ success: false, message: 'Invalid slot.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        ;
        const [availabilitySlotRows] = await connection.execute(`SELECT
        slot_start_timestamp,
        slot_end_timestamp
      FROM
        availability_slots
      WHERE
        hangout_member_id = ?
      LIMIT ${availabilitySlotsValidation.availabilitySlotsLimit};`, [requestData.hangoutMemberID]);
        if (availabilitySlotRows.length === availabilitySlotsValidation.availabilitySlotsLimit) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Availability slot limit reached.' });
            return;
        }
        ;
        if (availabilitySlotsValidation.intersectsWithExistingSlots(availabilitySlotRows, requestData)) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Slot intersection detected.' });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`INSERT INTO availability_slots(
        hangout_member_id,
        hangout_id,
        slot_start_timestamp,
        slot_end_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [requestData.hangoutMemberID, requestData.hangoutID, requestData.slotStartTimestamp, requestData.slotEndTimestamp]);
        await connection.commit();
        res.json({ success: true, resData: { availabilitySlotID: resultSetHeader.insertId } });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        if (connection) {
            connection.release();
        }
        ;
    }
    ;
});
exports.availabilitySlotsRouter.put('/', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const userID = (0, userUtils_1.getUserID)(authToken);
    const requestData = req.body;
    const expectedKeys = ['hangoutID', 'hangoutMemberID', 'availabilitySlotID', 'slotStartTimestamp', 'slotEndTimestamp'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutIDString)(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.availabilitySlotID)) {
        res.status(400).json({ success: false, message: 'Invalid availability slot ID.' });
        return;
    }
    ;
    if (!availabilitySlotsValidation.isInitiallyValidAvailabilitySlot(requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
        res.status(400).json({ success: false, message: 'Invalid slot.' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const userType = (0, userUtils_1.getUserType)(authToken);
        const [userRows] = await db_1.dbPool.execute(`SELECT
        auth_token
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`, [userID]);
        if (userRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (authToken !== userRows[0].auth_token) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
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
      LIMIT ${hangoutValidation_1.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const memberDetails = hangoutRows.find((member) => member.hangout_member_id === requestData.hangoutMemberID);
        if (!memberDetails) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (memberDetails[`${userType}_id`] !== userID) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails.is_concluded) {
            res.status(409).json({ success: false, message: 'Hangout concluded.' });
            return;
        }
        ;
        if (!availabilitySlotsValidation.isValidAvailabilitySlot(hangoutDetails.conclusion_timestamp, requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
            res.status(400).json({ success: false, message: 'Invalid slot.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        ;
        const [availabilitySlotRows] = await connection.execute(`SELECT
        availability_slot_id,
        slot_start_timestamp,
        slot_end_timestamp
      FROM
        availability_slots
      WHERE
        hangout_member_id = ?
      LIMIT ${availabilitySlotsValidation.availabilitySlotsLimit};`, [requestData.hangoutMemberID]);
        if (availabilitySlotRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Slot not found.' });
            return;
        }
        ;
        const slotToUpdate = availabilitySlotRows.find((slot) => slot.availability_slot_id === requestData.availabilitySlotID);
        if (!slotToUpdate) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Slot not found.' });
            return;
        }
        ;
        if (slotToUpdate.slot_start_timestamp === requestData.slotStartTimestamp &&
            slotToUpdate.slot_end_timestamp === requestData.slotStartTimestamp) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Slot identical.' });
            return;
        }
        ;
        const filteredExistingSlots = availabilitySlotRows.filter((slot) => slot.availability_slot_id !== requestData.availabilitySlotID);
        if (filteredExistingSlots.length === 0) {
            const [resultSetHeader] = await connection.execute(`UPDATE
          availability_slots
        SET
          slot_start_timestamp = ?,
          slot_end_timestamp = ?
        WHERE
          availability_slot_id = ?;`, [requestData.slotStartTimestamp, requestData.slotEndTimestamp, requestData.availabilitySlotID]);
            if (resultSetHeader.affectedRows === 0) {
                await connection.rollback();
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
            await connection.commit();
            res.json({ success: true, resData: {} });
            return;
        }
        ;
        if (availabilitySlotsValidation.intersectsWithExistingSlots(filteredExistingSlots, requestData)) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Slot intersection detected.' });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`UPDATE
        availability_slot
      SET
        slot_start_timestamp = ?,
        slot_end_timestamp = ?
      WHERE
        availability_slot_id = ?;`, [requestData.slotStartTimestamp, requestData.slotEndTimestamp, requestData.availabilitySlotID]);
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        if (connection) {
            connection.release();
        }
        ;
    }
    ;
});
exports.availabilitySlotsRouter.delete('/', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const userID = (0, userUtils_1.getUserID)(authToken);
    const requestData = req.body;
    const expectedKeys = ['hangoutMemberID', 'availabilitySlotID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.availabilitySlotID)) {
        res.status(400).json({ success: false, message: 'Invalid slot ID.' });
        return;
    }
    ;
    try {
        ;
        const userType = (0, userUtils_1.getUserType)(authToken);
        const [userRows] = await db_1.dbPool.execute(`SELECT
        auth_token
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`, [userID]);
        if (userRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (authToken !== userRows[0].auth_token) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        ;
        const [availabilitySlotRows] = await db_1.dbPool.execute(`SELECT
        hangout_members.account_id,
        hangout_members.guest_id,
        availability_slots.availability_slot_id
      FROM
        hangout_members
      LEFT JOIN
        availability_slots ON hangout_members.hangout_member_id = availability_slots.hangout_member_id
      WHERE
        hangout_members.hangout_member_id = ?
      LIMIT ${availabilitySlotsValidation.availabilitySlotsLimit};`, [requestData.hangoutMemberID]);
        if (availabilitySlotRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (availabilitySlotRows[0][`${userType}_id`] !== userID) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const slotFound = availabilitySlotRows.find((slot) => slot.availability_slot_id === requestData.availabilitySlotID) !== undefined;
        if (!slotFound) {
            res.status(404).json({ success: false, message: 'Slot not found.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        availability_slots
      WHERE
        availability_slot_id = ?;`, [requestData.availabilitySlotID]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.availabilitySlotsRouter.delete('/clear', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const userID = (0, userUtils_1.getUserID)(authToken);
    const requestData = req.body;
    const expectedKeys = ['hangoutMemberID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    try {
        ;
        const userType = (0, userUtils_1.getUserType)(authToken);
        const [userRows] = await db_1.dbPool.execute(`SELECT
        auth_token
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`, [userID]);
        if (userRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (authToken !== userRows[0].auth_token) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        ;
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        hangout_members.account_id,
        hangout_members.guest_id,
        availability_slots.availability_slot_id
      FROM
        hangout_members
      LEFT JOIN
        availabilitY_slots ON hangout_members.hangout_member_id = availability_slots.hangout_member_id
      WHERE
        hangout_members.hangout_member_id = ?;`, [requestData.hangoutMemberID]);
        if (hangoutMemberRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (hangoutMemberRows[0][`${userType}_id`] !== userID) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (hangoutMemberRows[0].availability_slot_id === null) {
            res.status(409).json({ success: false, message: 'No slots to clear.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        availabilitY_slots
      WHERE
        hangout_member_id = ?;`, [requestData.hangoutMemberID]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: { slotsDeleted: resultSetHeader.affectedRows } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
