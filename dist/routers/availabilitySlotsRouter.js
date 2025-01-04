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
const requestValidation_1 = require("../util/validation/requestValidation");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const availabilitySlotValidation = __importStar(require("../util/validation/availabilitySlotValidation"));
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const cookieUtils_1 = require("../util/cookieUtils");
const authUtils = __importStar(require("../auth/authUtils"));
const authSessions_1 = require("../auth/authSessions");
const constants_1 = require("../util/constants");
exports.availabilitySlotsRouter = express_1.default.Router();
exports.availabilitySlotsRouter.post('/', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'slotStartTimestamp', 'slotEndTimestamp'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.', reason: 'hangoutId' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.', reason: 'hangoutMemberId' });
        return;
    }
    ;
    if (!availabilitySlotValidation.isValidAvailabilitySlot(requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
        res.status(400).json({ success: false, message: 'Invalid availability slot.' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        ;
        const [hangoutMemberRows] = await connection.execute(`SELECT
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
      LIMIT ${constants_1.HANGOUT_AVAILABILITY_SLOTS_LIMIT};`, [requestData.hangoutId, requestData.hangoutMemberId]);
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (hangoutMemberDetails.is_concluded) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Hangout is already concluded.' });
            return;
        }
        ;
        if (!availabilitySlotValidation.isValidAvailabilitySlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.slotStartTimestamp)) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Invalid availability slot start.' });
            return;
        }
        ;
        const existingAvailabilitySlots = hangoutMemberRows.map((member) => ({
            availability_slot_id: member.availability_slot_id,
            hangout_member_id: requestData.hangoutMemberId,
            slot_start_timestamp: member.slot_start_timestamp,
            slot_end_timestamp: member.slot_end_timestamp,
        }));
        if (existingAvailabilitySlots.length >= constants_1.HANGOUT_AVAILABILITY_SLOTS_LIMIT) {
            await connection.rollback();
            res.status(409).json({ success: false, message: `Availability slots limit of ${constants_1.HANGOUT_AVAILABILITY_SLOTS_LIMIT} reached.` });
            return;
        }
        ;
        const { slotStartTimestamp, slotEndTimestamp } = requestData;
        const overlappedSlotId = availabilitySlotValidation.overlapsWithExistingAvailabilitySlots(existingAvailabilitySlots, { slotStartTimestamp, slotEndTimestamp });
        if (overlappedSlotId) {
            const overlappedSlot = existingAvailabilitySlots.find((slot) => slot.availability_slot_id === overlappedSlotId);
            if (!overlappedSlot) {
                await connection.rollback();
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
            await connection.rollback();
            res.status(409).json({
                success: false,
                message: 'Overlap detected.',
                reason: 'slotOverlap',
                resData: {
                    overlappedSlotStartTimestamp: overlappedSlot.slot_start_timestamp,
                    overlappedSlotEndTimestamp: overlappedSlot.slot_end_timestamp,
                },
            });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`INSERT INTO availability_slots (
        hangout_member_id,
        hangout_id,
        slot_start_timestamp,
        slot_end_timestamp
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(4)});`, [requestData.hangoutMemberId, requestData.hangoutId, requestData.slotStartTimestamp, requestData.slotEndTimestamp]);
        await connection.commit();
        res.status(201).json({ success: true, resData: { availabilitySlotId: resultSetHeader.insertId } });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
exports.availabilitySlotsRouter.patch('/', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'availabilitySlotId', 'slotStartTimestamp', 'slotEndTimestamp'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.availabilitySlotId)) {
        res.status(400).json({ success: false, message: 'Invalid availability slot ID.' });
        return;
    }
    ;
    if (!availabilitySlotValidation.isValidAvailabilitySlot(requestData.slotStartTimestamp, requestData.slotEndTimestamp)) {
        res.status(400).json({ success: false, message: 'Invalid availability slot.' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        ;
        const [hangoutMemberRows] = await connection.execute(`SELECT
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
      LIMIT ${constants_1.HANGOUT_AVAILABILITY_SLOTS_LIMIT};`, [requestData.hangoutId, requestData.hangoutMemberId]);
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (hangoutMemberDetails.is_concluded) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Hangout is already concluded.' });
            return;
        }
        ;
        if (!availabilitySlotValidation.isValidAvailabilitySlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.slotStartTimestamp)) {
            await connection.rollback();
            res.status(400).json({ success: false, message: 'Invalid availability slot.' });
            return;
        }
        ;
        if (!hangoutMemberDetails.availability_slot_id) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Availability slot not found.' });
            return;
        }
        ;
        const requesterMemberSlots = hangoutMemberRows.map((member) => ({
            availability_slot_id: member.availability_slot_id,
            hangout_member_id: requestData.hangoutMemberId,
            slot_start_timestamp: member.slot_start_timestamp,
            slot_end_timestamp: member.slot_end_timestamp,
        }));
        const slotToUpdate = requesterMemberSlots.find((slot) => slot.availability_slot_id === requestData.availabilitySlotId);
        if (!slotToUpdate) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Availability slot not found.' });
            return;
        }
        ;
        if (slotToUpdate.slot_start_timestamp === requestData.slotStartTimestamp &&
            slotToUpdate.slot_end_timestamp === requestData.slotEndTimestamp) {
            await connection.rollback();
            res.status(409).json({ success: false, message: `New availability slot is identical to the one you're trying to change.` });
            return;
        }
        ;
        const filteredExistingSlots = requesterMemberSlots.filter((slot) => slot.availability_slot_id !== requestData.availabilitySlotId);
        const { slotStartTimestamp, slotEndTimestamp } = requestData;
        const overlappedSlotId = availabilitySlotValidation.overlapsWithExistingAvailabilitySlots(filteredExistingSlots, { slotStartTimestamp, slotEndTimestamp });
        if (overlappedSlotId) {
            const overlappedSlot = filteredExistingSlots.find((slot) => slot.availability_slot_id === overlappedSlotId);
            if (!overlappedSlot) {
                await connection.rollback();
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
            await connection.rollback();
            res.status(409).json({
                success: false,
                message: 'Overlap detected.',
                reason: 'slotOverlap',
                resData: {
                    overlappedSlotStartTimestamp: overlappedSlot.slot_start_timestamp,
                    overlappedSlotEndTimestamp: overlappedSlot.slot_end_timestamp,
                },
            });
            return;
        }
        ;
        if (availabilitySlotValidation.overlapsWithExistingAvailabilitySlots(filteredExistingSlots, requestData)) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Availability slot intersection detected.' });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`UPDATE
        availability_slot
      SET
        slot_start_timestamp = ?,
        slot_end_timestamp = ?
      WHERE
        availability_slot_id = ?;`, [requestData.slotStartTimestamp, requestData.slotEndTimestamp, requestData.availabilitySlotId]);
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
        await connection?.rollback();
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
exports.availabilitySlotsRouter.delete('/', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'availabilitySlotId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.availabilitySlotId)) {
        res.status(400).json({ success: false, message: 'Invalid availability slot ID.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
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
      LIMIT ${constants_1.HANGOUT_AVAILABILITY_SLOTS_LIMIT};`, [requestData.hangoutId, requestData.hangoutMemberId]);
        if (hangoutMemberRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (hangoutMemberDetails.is_concluded) {
            res.status(409).json({ success: false, message: 'Hangout is already concluded.' });
            return;
        }
        ;
        if (!hangoutMemberDetails.availability_slot_id) {
            res.status(404).json({ success: false, message: 'Availability slot not found.' });
            return;
        }
        ;
        const slotFound = hangoutMemberRows.find((member) => member.availability_slot_id === requestData.availabilitySlotId) !== undefined;
        if (!slotFound) {
            res.status(404).json({ success: false, message: 'Availability slot not found.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        availability_slots
      WHERE
        availability_slot_id = ?;`, [requestData.availabilitySlotId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.availabilitySlotsRouter.delete('/clear', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'hangoutMemberId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERe
        session_id = ?;`, { authSessionId });
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
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
      LIMIT ${constants_1.HANGOUT_AVAILABILITY_SLOTS_LIMIT};`, [requestData.hangoutId, requestData.hangoutMemberId]);
        if (hangoutMemberRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (hangoutMemberDetails.is_concluded) {
            res.status(409).json({ success: false, message: 'Hangout is already concluded.' });
            return;
        }
        ;
        if (!hangoutMemberDetails.availability_slot_id) {
            res.status(404).json({ success: false, message: 'No slots found.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        availability_slots
      WHERE
        hangout_member_id = ?
      LIMIT ${constants_1.HANGOUT_AVAILABILITY_SLOTS_LIMIT};`, [requestData.hangoutMemberId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: { deletedSlots: resultSetHeader.affectedRows } });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.availabilitySlotsRouter.get('/', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const hangoutId = req.query.hangoutId;
    const hangoutMemberId = req.query.hangoutMemberId;
    if (typeof hangoutId !== 'string' || typeof hangoutMemberId !== 'string') {
        res.status(400).json({ success: false, message: 'Something went wrong.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(hangoutId)) {
        res.status(400).json({ success: false, message: 'Something went wrong.' });
        return;
    }
    ;
    if (!Number.isInteger(+hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Something went wrong.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [validationRows] = await db_1.dbPool.execute(`SELECT
        1
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        hangout_id = ?;`, [+hangoutMemberId, hangoutId]);
        if (validationRows.length === 0) {
            res.status(401).json({ success: false, message: 'Not a member of this hangout.' });
            return;
        }
        ;
        ;
        const [availabilitySlotRows] = await db_1.dbPool.execute(`SELECT
        availability_slot_id,
        hangout_member_id,
        slot_start_timestamp,
        slot_end_timestamp
      FROM
        availability_slots
      WHERE
        hangout_id = ?
      LIMIT ${constants_1.MAX_HANGOUT_MEMBERS_LIMIT * constants_1.HANGOUT_AVAILABILITY_SLOTS_LIMIT};`, [hangoutId]);
        res.json({ availabilitySlots: availabilitySlotRows });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
