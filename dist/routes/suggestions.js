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
exports.suggestionsRouter = void 0;
const db_1 = require("../db/db");
const express_1 = __importDefault(require("express"));
const suggestionValidation = __importStar(require("../util/validation/suggestionValidation"));
const userValidation_1 = require("../util/validation/userValidation");
const userUtils_1 = require("../util/userUtils");
const requestValidation_1 = require("../util/validation/requestValidation");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
exports.suggestionsRouter = express_1.default.Router();
exports.suggestionsRouter.post('/', async (req, res) => {
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
    const expectedKeys = ['hangoutID', 'hangoutMemberID', 'suggestionTitle', 'suggestionDescription', 'suggestionStartTimestamp', 'suggestionEndTimestamp'];
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
    if (!suggestionValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion title.' });
        return;
    }
    ;
    if (!suggestionValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion description.' });
        return;
    }
    ;
    if (!suggestionValidation.isValidSuggestionTimeSlot(requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion time slot.' });
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
            res.status(400).json({ success: false, message: 'Invalid request data.' });
            return;
        }
        ;
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangouts.current_step,
        hangouts.conclusion_timestamp,
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
        const isMember = hangoutRows.find((member) => member.hangout_member_id === requestData.hangoutMemberID && member[`${userType}_id`] === userID) !== undefined;
        if (!isMember) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails.current_step !== 2) {
            res.status(409).json({ success: false, message: 'Not in suggestions step.' });
            return;
        }
        ;
        if (!suggestionValidation.isValidSuggestionSlotStart(hangoutDetails.conclusion_timestamp, requestData.suggestionStartTimestamp)) {
            res.status(400).json({ success: false, message: 'Invalid suggestion time slot.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        ;
        const [suggestionRows] = await connection.execute(`SELECT
        suggestion_id
      FROM
        suggestions
      WHERE
        hangout_member_id = ?
      LIMIT ${suggestionValidation.suggestionsLimit};`, [requestData.hangoutMemberID]);
        if (suggestionRows.length === suggestionValidation.suggestionsLimit) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Suggestion limit reached.' });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`INSERT INTO suggestions(
        hangout_member_id,
        hangout_id,
        suggestion_title,
        suggestion_description,
        suggestion_start_timestamp,
        suggestion_end_timestamp,
        is_edited
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(7)});`, [requestData.hangoutMemberID, requestData.hangoutID, requestData.suggestionTitle, requestData.suggestionDescription, requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp, false]);
        await connection.commit();
        res.json({ success: true, resData: { suggestionID: resultSetHeader.insertId } });
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
exports.suggestionsRouter.put('/', async (req, res) => {
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
    const expectedKeys = ['hangoutID', 'hangoutMemberID', 'suggestionID', 'suggestionTitle', 'suggestionDescription', 'suggestionStartTimestamp', 'suggestionEndTimestamp'];
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
    if (!suggestionValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion title.' });
        return;
    }
    ;
    if (!suggestionValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion description.' });
        return;
    }
    ;
    if (!suggestionValidation.isValidSuggestionTimeSlot(requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion time slot.' });
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
        hangouts.conclusion_timestamp,
        hangout_members.hangout_member_id,
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id,
        suggestions.suggestion_title,
        suggestions.suggestion_description,
        suggestions.suggestion_start_timestamp,
        suggestions.suggestion_end_timestamp
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangouts.hangout_id = ?;`, [requestData.hangoutID]);
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
        if (hangoutRows[0].current_step === 1) {
            res.status(409).json({ success: false, message: 'Not in suggestions step.' });
            return;
        }
        ;
        if (hangoutRows[0].current_step === 4) {
            res.status(409).json({ success: false, message: 'Hangout concluded.' });
            return;
        }
        ;
        const suggestionToEdit = hangoutRows.find((suggestion) => suggestion.suggestion_id === requestData.suggestionID);
        if (!suggestionToEdit) {
            res.status(404).json({ success: false, message: 'Suggestion not found.' });
            return;
        }
        ;
        if (suggestionToEdit.hangout_member_id !== requestData.hangoutMemberID) {
            res.status(401).json({ success: false, message: 'Not suggestion owner.' });
            return;
        }
        ;
        if (!suggestionValidation.isValidSuggestionSlotStart(hangoutRows[0].conclusion_timestamp, requestData.suggestionStartTimestamp)) {
            res.status(400).json({ success: false, message: 'Invalid suggestion time slot.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        suggestions
      SET
        suggestion_title = ?,
        suggestion_description = ?,
        suggestion_start_timestamp = ?,
        suggestion_end_timestamp = ?,
        is_edited = ?
      WHERE
        suggestion_id = ?;`, [requestData.suggestionTitle, requestData.suggestionDescription, requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp, requestData.suggestionID, true]);
        if (resultSetHeader.affectedRows === 0) {
            await db_1.dbPool.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        let deletedVotes = 0;
        if (requestData.suggestionTitle !== suggestionToEdit.suggestion_title) {
            const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
          votes
        WHERE
          suggestion_id = ?;`, [requestData.suggestionID]);
            deletedVotes = resultSetHeader.affectedRows;
        }
        ;
        res.json({ success: true, resData: { deletedVotes } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.suggestionsRouter.delete('/', async (req, res) => {
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
    const expectedKeys = ['hangoutMemberID', 'suggestionID'];
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
    if (!Number.isInteger(requestData.suggestionID)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion ID.' });
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
        const [memberSuggestionRows] = await db_1.dbPool.execute(`SELECT
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id
      FROM
        hangout_members
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangout_members.hangout_member_id = ?
      LIMIT ${suggestionValidation.suggestionsLimit};`, [requestData.hangoutMemberID]);
        if (memberSuggestionRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (memberSuggestionRows[0][`${userType}_id`] !== userID) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const suggestionFound = memberSuggestionRows.find((suggestion) => suggestion.suggestion_id === requestData.suggestionID) !== undefined;
        if (!suggestionFound) {
            res.status(404).json({ success: false, message: 'Suggestion not found.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        suggestions
      WHERE
        suggestion_id = ?;`, [requestData.suggestionID]);
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
exports.suggestionsRouter.delete('/clear', async (req, res) => {
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
        res.status(400).json({ succesS: false, message: 'Invalid hangout member ID.' });
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
        const [memberSuggestionRows] = await db_1.dbPool.execute(`SELECT
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id
      FROM
        hangout_members
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangout_members.hangout_member_id = ?
      LIMIT 1;`, [requestData.hangoutMemberID]);
        if (memberSuggestionRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const memberSuggestion = memberSuggestionRows[0];
        if (memberSuggestion[`${userType}_id`] !== userID) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (!memberSuggestion.suggestion_id) {
            res.status(409).json({ success: false, message: 'No suggestions to clear.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        suggestions
      WHERE
        hangout_member_id = ?;`, [requestData.hangoutMemberID]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: { suggestionsDeleted: resultSetHeader.affectedRows } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
