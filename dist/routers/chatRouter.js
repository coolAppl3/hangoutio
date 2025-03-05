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
exports.chatRouter = void 0;
const express_1 = __importDefault(require("express"));
const requestValidation_1 = require("../util/validation/requestValidation");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const chatValidation_1 = require("../util/validation/chatValidation");
const db_1 = require("../db/db");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const authUtils = __importStar(require("../auth/authUtils"));
const cookieUtils_1 = require("../util/cookieUtils");
const authSessions_1 = require("../auth/authSessions");
exports.chatRouter = express_1.default.Router();
exports.chatRouter.post('/add', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutMemberId', 'messageContent'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member Id', reason: 'hangoutMemberId' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.', reason: 'hangoutId' });
        return;
    }
    ;
    if (!(0, chatValidation_1.isValidMessageContent)(requestData.messageContent)) {
        res.status(400).json({ message: 'Invalid message content', reason: 'messageContent' });
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
        session_id = ?;`, { authSessionId });
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
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
        hangout_member_id = ?;`, [requestData.hangoutMemberId]);
        const hangoutMemberDetails = hangoutRows[0];
        if (!hangoutMemberDetails) {
            res.status(404).json({ message: 'Hangout not found.' });
            return;
        }
        ;
        if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (hangoutMemberDetails.hangout_id !== requestData.hangoutId) {
            res.status(404).json({ message: 'Hangout not found.' });
            return;
        }
        ;
        const messageTimestamp = Date.now();
        const [resultSetHeader] = await db_1.dbPool.execute(`INSERT INTO chat (
        hangout_member_id,
        hangout_id,
        message_content,
        message_timestamp
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(4)});`, [requestData.hangoutMemberId, hangoutMemberDetails.hangout_id, requestData.messageContent, messageTimestamp]);
        ;
        const chatMessage = {
            messageId: resultSetHeader.insertId,
            hangoutMemberId: requestData.hangoutMemberId,
            hangoutId: hangoutMemberDetails.hangout_id,
            messageContent: requestData.messageContent,
            messageTimestamp,
        };
        res.status(200).json({ chatMessage });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
    }
    ;
});
exports.chatRouter.post('/retrieve', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'messageOffset'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.', reason: 'hangoutId' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.', reason: 'hangoutMemberId' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.messageOffset)) {
        res.status(400).json({ message: 'Invalid messages offset.', reason: 'messageOffset' });
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
        session_id = ?;`, { authSessionId });
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails)) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        1 AS hangout_found
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        ${authSessionDetails.user_type}_id = ? AND
        hangout_id = ?;`, [requestData.hangoutMemberId, authSessionDetails.user_id, requestData.hangoutId]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ message: 'Hangout not found.' });
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
        res.json({ chatMessages: chatRows });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
    }
    ;
});
