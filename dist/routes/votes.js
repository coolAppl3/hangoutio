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
exports.votesRouter = void 0;
const db_1 = require("../db/db");
const express_1 = __importDefault(require("express"));
const userValidation_1 = require("../util/validation/userValidation");
const userUtils_1 = require("../util/userUtils");
const requestValidation_1 = require("../util/validation/requestValidation");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const voteValidation = __importStar(require("../util/validation/voteValidation"));
const availabilitySlotValidation_1 = require("../util/validation/availabilitySlotValidation");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
exports.votesRouter = express_1.default.Router();
exports.votesRouter.post('/', async (req, res) => {
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
    const expectedKeys = ['hangoutID', 'hangoutMemberID', 'suggestionID'];
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
    if (!Number.isInteger(requestData.suggestionID)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion ID.' });
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
      LIMIT ${hangoutValidation_1.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutRows.length === 0) {
            res.status(400).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isMember = hangoutRows.find((member) => member.hangout_member_id === requestData.hangoutMemberID && member[`${userType}_id`] === userID) !== undefined;
        if (!isMember) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (hangoutRows[0].current_step !== 3) {
            res.status(409).json({ success: false, message: 'Not in voting step.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        ;
        const [memberVotesRows] = await connection.execute(`SELECT
        EXISTS (SELECT 1 FROM suggestions WHERE suggestion_id = ? AND hangout_id = ?) AS suggestion_found,
        EXISTS (SELECT 1 FROM votes WHERE hangout_member_id = ? AND suggestion_id = ?) as already_voted,
        (SELECT COUNT(*) FROM votes WHERE hangout_member_id = ?) AS total_votes
      ;`, [requestData.suggestionID, requestData.hangoutID, requestData.hangoutMemberID, requestData.suggestionID, requestData.hangoutID]);
        const memberVotes = memberVotesRows[0];
        if (!memberVotes.suggestion_found) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Suggestion not found.' });
            return;
        }
        ;
        if (memberVotes.already_voted) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Already voted.' });
            return;
        }
        ;
        if (memberVotes.total_votes >= voteValidation.votesLimit) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Vote limit reached.' });
            return;
        }
        ;
        ;
        const [suggestionAvailabilityRows] = await connection.execute(`SELECT
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
      LIMIT ${availabilitySlotValidation_1.availabilitySlotsLimit};`, [requestData.suggestionID, requestData.hangoutMemberID]);
        if (suggestionAvailabilityRows.length === 0) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'No matching availability.' });
            return;
        }
        ;
        ;
        const suggestionTimeSlot = {
            start: suggestionAvailabilityRows[0].suggestion_start_timestamp,
            end: suggestionAvailabilityRows[0].suggestion_end_timestamp,
        };
        ;
        const availabilitySlots = suggestionAvailabilityRows.map((row) => ({
            start: row.slot_start_timestamp,
            end: row.slot_end_timestamp,
        }));
        if (!voteValidation.isAvailableForSuggestion(suggestionTimeSlot, availabilitySlots)) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'No matching availability.' });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`INSERT INTO votes(
        hangout_member_id,
        suggestion_id,
        hangout_id
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [requestData.hangoutMemberID, requestData.suggestionID, requestData.hangoutID]);
        await connection.commit();
        res.json({ success: true, resData: { voteID: resultSetHeader.insertId } });
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
exports.votesRouter.delete('/', async (req, res) => {
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
    const expectedKeys = ['hangoutID', 'hangoutMemberID', 'voteID'];
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
    if (!Number.isInteger(requestData.voteID)) {
        res.status(400).json({ success: false, message: 'Invalid vote ID.' });
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
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangouts.current_step,
        hangout_members.hangout_member_id,
        hangout_members.account_id,
        hangout_members.guest_id
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangout_id = ?
      LIMIT ${hangoutValidation_1.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isMember = hangoutRows.find((member) => member.hangout_member_id === requestData.hangoutMemberID && member[`${userType}_id`] === userID) !== undefined;
        if (!isMember) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (hangoutRows[0].current_step !== 3) {
            res.status(409).json({ success: false, message: 'Not in voting step.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        votes
      WHERE
        vote_id = ?;`, [requestData.voteID]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Vote not found.' });
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
