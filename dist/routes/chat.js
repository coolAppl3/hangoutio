"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = void 0;
const express_1 = __importDefault(require("express"));
const userValidation_1 = require("../util/validation/userValidation");
const userUtils_1 = require("../util/userUtils");
const requestValidation_1 = require("../util/validation/requestValidation");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const chatValidation_1 = require("../util/validation/chatValidation");
const db_1 = require("../db/db");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
exports.chatRouter = express_1.default.Router();
exports.chatRouter.post('/add', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    if (!(0, userValidation_1.isValidAuthToken)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const userId = (0, userUtils_1.getUserId)(authToken);
    const requestData = req.body;
    const expectedKeys = ['hangoutMemberId', 'messageContent'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member Id', reason: 'hangoutMemberId' });
        return;
    }
    ;
    if (!(0, chatValidation_1.isValidMessageContent)(requestData.messageContent)) {
        res.status(400).json({ success: false, message: 'Invalid message content', reason: 'messageContent' });
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
        ${userType}_id = ?;`, [userId]);
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
        hangout_id,
        display_name
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        ${userType}_id = ?;`, [requestData.hangoutMemberId, userId]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMember = hangoutRows[0];
        const messageTimestamp = Date.now();
        const [resultSetHeader] = await db_1.dbPool.execute(`INSERT INTO chat(
        hangout_member_id,
        hangout_id,
        message_content,
        message_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)});`, [requestData.hangoutMemberId, hangoutMember.hangout_id, requestData.messageContent, messageTimestamp]);
        ;
        const chatMessage = {
            messageId: resultSetHeader.insertId,
            hangoutMemberId: requestData.hangoutMemberId,
            hangoutId: hangoutMember.hangout_id,
            messageContent: requestData.messageContent,
            messageTimestamp,
        };
        res.status(201).json({ success: true, resData: { chatMessage } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.chatRouter.post('/retrieve', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    if (!(0, userValidation_1.isValidAuthToken)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const userId = (0, userUtils_1.getUserId)(authToken);
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'messageOffset'];
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
    if (!Number.isInteger(requestData.messageOffset)) {
        res.status(400).json({ success: false, message: 'Invalid messages offset.', reason: 'messageOffset' });
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
        ${userType}_id = ?;`, [userId]);
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
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        1
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        ${userType}_id = ? AND
        hangout_id = ?;`, [requestData.hangoutMemberId, userId, requestData.hangoutId]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        ;
        const [chatRows] = await db_1.dbPool.execute(`SELECT
        chat.message_id,
        chat.hangout_member_id,
        chat.message_content,
        chat.message_timestamp,
        hangout_members.display_name as sender_name
      FROM
        chat
      LEFT JOIN
        hangout_members ON chat.hangout_member_id = hangout_members.hangout_member_id
      WHERE
        chat.hangout_id = ?
      ORDER BY
        chat.message_timestamp DESC
      LIMIT 20 OFFSET ?;`, [requestData.hangoutId, requestData.messageOffset]);
        res.json({ success: true, chatMessages: chatRows });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
