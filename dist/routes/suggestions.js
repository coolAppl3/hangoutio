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
const suggestionsValidation = __importStar(require("../util/validation/suggestionsValidation"));
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
    const expectedKeys = ['hangoutID', 'hangoutMemberID', 'suggestionTitle', 'suggestionDescription'];
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
    if (!suggestionsValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion title.' });
        return;
    }
    ;
    if (!suggestionsValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion description.' });
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
        if (hangoutRows[0].current_step !== 2) {
            res.status(409).json({ success: false, message: 'Not in suggestions step.' });
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
      LIMIT ${suggestionsValidation.suggestionsLimit};`, [requestData.hangoutMemberID]);
        if (suggestionRows.length === suggestionsValidation.suggestionsLimit) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Suggestion limit reached.' });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`INSERT INTO suggestions(
        hangout_member_id,
        suggestion_title,
        suggestion_description
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [requestData.hangoutMemberID, requestData.suggestionTitle, requestData.suggestionDescription]);
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
    const expectedKeys = ['hangoutMemberID', 'suggestionID', 'suggestionTitle', 'suggestionDescription'];
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
    if (!suggestionsValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion title.' });
        return;
    }
    ;
    if (!suggestionsValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion description.' });
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
        suggestions.suggestion_id,
        suggestions.suggestion_title,
        suggestions.suggestion_description
      FROM
        hangout_members
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangout_members.hangout_member_id = ?
      LIMIT ${suggestionsValidation.suggestionsLimit};`, [requestData.hangoutMemberID]);
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
        const suggestionToUpdate = memberSuggestionRows.find((suggestion) => suggestion.suggestion_id === requestData.suggestionID);
        if (!suggestionToUpdate) {
            res.status(404).json({ success: false, message: 'Suggestion not found.' });
            return;
        }
        ;
        if (requestData.suggestionTitle === suggestionToUpdate.suggestion_title &&
            requestData.suggestionDescription === suggestionToUpdate.suggestion_description) {
            res.status(409).json({ success: false, message: 'Suggestion identical.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        suggestions
      SET
        suggestion_title = ?,
        suggestion_description = ?
      WHERE
        suggestion_id = ?;`, [requestData.suggestionTitle, requestData.suggestionDescription, requestData.suggestionID]);
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
      LIMIT ${suggestionsValidation.suggestionsLimit};`, [requestData.hangoutMemberID]);
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
      LIMIT ${suggestionsValidation.suggestionsLimit};`, [requestData.hangoutMemberID]);
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
        if (memberSuggestionRows[0].suggestion_id === null) {
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
