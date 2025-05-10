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
const requestValidation_1 = require("../util/validation/requestValidation");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const authUtils = __importStar(require("../auth/authUtils"));
const cookieUtils_1 = require("../util/cookieUtils");
const authSessions_1 = require("../auth/authSessions");
const constants_1 = require("../util/constants");
const isSqlError_1 = require("../util/isSqlError");
const hangoutWebSocketServer_1 = require("../webSockets/hangout/hangoutWebSocketServer");
exports.suggestionsRouter = express_1.default.Router();
exports.suggestionsRouter.post('/', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'suggestionTitle', 'suggestionDescription', 'suggestionStartTimestamp', 'suggestionEndTimestamp'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!suggestionValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
        res.status(400).json({ message: 'Invalid suggestion title.', reason: 'title' });
        return;
    }
    ;
    if (!suggestionValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
        res.status(400).json({ message: 'Invalid suggestion description.', reason: 'description' });
        return;
    }
    ;
    if (!suggestionValidation.isValidSuggestionTimeSlot(requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp)) {
        res.status(400).json({ message: 'Invalid suggestion date and time.', reason: 'dateTime' });
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
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        ;
        const [hangoutMemberRows] = await connection.execute(`SELECT
        (
          hangouts.created_on_timestamp + hangouts.availability_period + hangouts.suggestions_period + hangouts.voting_period
        ) AS conclusion_timestamp,
        hangouts.is_concluded,
        hangouts.current_stage,
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${constants_1.HANGOUT_SUGGESTIONS_LIMIT};`, [requestData.hangoutId, requestData.hangoutMemberId]);
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (!hangoutMemberDetails) {
            await connection.rollback();
            res.status(404).json({ message: 'Hangout not found.' });
            return;
        }
        ;
        if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            await connection.rollback();
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (hangoutMemberDetails.is_concluded) {
            await connection.rollback();
            res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });
            return;
        }
        ;
        if (hangoutMemberDetails.current_stage !== constants_1.HANGOUT_SUGGESTIONS_STAGE) {
            const reason = hangoutMemberDetails.current_stage === constants_1.HANGOUT_AVAILABILITY_STAGE
                ? 'inAvailabilityStage'
                : 'inVotingStage';
            await connection.rollback();
            res.status(403).json({ message: `Hangout isn't in the suggestions stage.`, reason });
            return;
        }
        ;
        if (!suggestionValidation.isValidSuggestionSlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.suggestionStartTimestamp)) {
            await connection.rollback();
            res.status(400).json({ message: 'Invalid suggestion date and time.', reason: 'dateTime' });
            return;
        }
        ;
        if (hangoutMemberRows.length === constants_1.HANGOUT_SUGGESTIONS_LIMIT) {
            await connection.rollback();
            res.status(409).json({ message: `Suggestions limit of ${constants_1.HANGOUT_SUGGESTIONS_LIMIT} reached.`, reason: 'limitReached' });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`INSERT INTO suggestions (
        hangout_member_id,
        hangout_id,
        suggestion_title,
        suggestion_description,
        suggestion_start_timestamp,
        suggestion_end_timestamp,
        is_edited
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(7)});`, [requestData.hangoutMemberId, requestData.hangoutId, requestData.suggestionTitle, requestData.suggestionDescription, requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp, false]);
        await connection.commit();
        res.status(201).json({ suggestionId: resultSetHeader.insertId });
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([requestData.hangoutId], {
            type: 'suggestion',
            reason: 'newSuggestion',
            data: {
                newSuggestion: {
                    suggestion_id: resultSetHeader.insertId,
                    hangout_member_id: requestData.hangoutMemberId,
                    suggestion_title: requestData.suggestionTitle,
                    suggestion_description: requestData.suggestionDescription,
                    suggestion_start_timestamp: requestData.suggestionStartTimestamp,
                    suggestion_end_timestamp: requestData.suggestionEndTimestamp,
                    is_edited: false,
                    likes_count: 0,
                    votes_count: 0,
                },
            },
        });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
exports.suggestionsRouter.patch('/', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'suggestionId', 'suggestionTitle', 'suggestionDescription', 'suggestionStartTimestamp', 'suggestionEndTimestamp'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.suggestionId)) {
        res.status(400).json({ message: 'Invalid suggestion ID.' });
        return;
    }
    ;
    if (!suggestionValidation.isValidSuggestionTitle(requestData.suggestionTitle)) {
        res.status(400).json({ message: 'Invalid suggestion title.', reason: 'invalidTitle' });
        return;
    }
    ;
    if (!suggestionValidation.isValidSuggestionDescription(requestData.suggestionDescription)) {
        res.status(400).json({ message: 'Invalid suggestion description.', reason: 'invalidDescription' });
        return;
    }
    ;
    if (!suggestionValidation.isValidSuggestionTimeSlot(requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp)) {
        res.status(400).json({ message: 'Invalid suggestion time slot.', reason: 'dateTime' });
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
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        (
          hangouts.created_on_timestamp + hangouts.availability_period + hangouts.suggestions_period + hangouts.voting_period
        ) AS conclusion_timestamp,
        hangouts.is_concluded,
        hangouts.current_stage,
        hangout_members.account_id,
        hangout_members.guest_id,
        suggestions.suggestion_id,
        suggestions.suggestion_title,
        suggestions.suggestion_description,
        suggestions.suggestion_start_timestamp,
        suggestions.suggestion_end_timestamp
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      LEFT JOIN
        suggestions ON hangout_members.hangout_member_id = suggestions.hangout_member_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT ${constants_1.HANGOUT_SUGGESTIONS_LIMIT};`, [requestData.hangoutId, requestData.hangoutMemberId]);
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (!hangoutMemberDetails) {
            res.status(404).json({ message: 'Hangout not found.', reason: 'hangoutNotfound' });
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
        if (hangoutMemberDetails.is_concluded) {
            res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });
            return;
        }
        ;
        if (hangoutMemberDetails.current_stage === constants_1.HANGOUT_AVAILABILITY_STAGE) {
            res.status(403).json({ message: `Hangout hasn't reached the suggestions stage yet.`, reason: 'inAvailabilityStage' });
            return;
        }
        ;
        const suggestionToEdit = hangoutMemberRows.find((suggestion) => suggestion.suggestion_id === requestData.suggestionId);
        if (!suggestionToEdit) {
            res.status(404).json({ message: 'Suggestion not found.', reason: 'suggestionNotFound' });
            return;
        }
        ;
        if (!suggestionValidation.isValidSuggestionSlotStart(hangoutMemberDetails.conclusion_timestamp, requestData.suggestionStartTimestamp)) {
            res.status(400).json({ message: 'Invalid suggestion time slot.', reason: 'dateTime' });
            return;
        }
        ;
        let isIdentical = true;
        let isMajorChange = false;
        if (suggestionToEdit.suggestion_start_timestamp !== requestData.suggestionStartTimestamp) {
            isIdentical = false;
            isMajorChange = true;
        }
        ;
        if (suggestionToEdit.suggestion_end_timestamp !== requestData.suggestionEndTimestamp) {
            isIdentical = false;
            isMajorChange = true;
        }
        ;
        if (suggestionToEdit.suggestion_title !== requestData.suggestionTitle) {
            isIdentical = false;
            isMajorChange = true;
        }
        ;
        if (suggestionToEdit.suggestion_description !== requestData.suggestionDescription) {
            isIdentical = false;
        }
        ;
        if (isIdentical) {
            res.status(409).json({ message: 'No suggestion changes found.' });
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
        suggestion_id = ?;`, [requestData.suggestionTitle, requestData.suggestionDescription, requestData.suggestionStartTimestamp, requestData.suggestionEndTimestamp, true, requestData.suggestionId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ isMajorChange });
        if (isMajorChange) {
            await db_1.dbPool.query(`DELETE FROM
          votes
        WHERE
          suggestion_id = :suggestionId;
        
        DELETE FROM
          suggestion_likes
        WHERE
          suggestion_id = :suggestionId;`, { suggestionId: requestData.suggestionId });
        }
        ;
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([requestData.hangoutId], {
            type: 'suggestion',
            reason: 'suggestionUpdated',
            data: {
                isMajorChange,
                updatedSuggestion: {
                    suggestion_id: requestData.suggestionId,
                    hangout_member_id: requestData.hangoutMemberId,
                    suggestion_title: requestData.suggestionTitle,
                    suggestion_description: requestData.suggestionDescription,
                    suggestion_start_timestamp: requestData.suggestionStartTimestamp,
                    suggestion_end_timestamp: requestData.suggestionEndTimestamp,
                    is_edited: true,
                    likes_count: 0,
                    votes_count: 0,
                },
            },
        });
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
exports.suggestionsRouter.delete('/', async (req, res) => {
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
    const suggestionId = req.query.suggestionId;
    const hangoutMemberId = req.query.hangoutMemberId;
    const hangoutId = req.query.hangoutId;
    if (typeof suggestionId !== 'string' || typeof hangoutMemberId !== 'string' || typeof hangoutId !== 'string') {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(+suggestionId)) {
        res.status(400).json({ message: 'Invalid suggestion ID.' });
        return;
    }
    ;
    if (!Number.isInteger(+hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
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
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        hangouts.is_concluded,
        hangouts.current_stage,
        hangout_members.account_id,
        hangout_members.guest_id,
        EXISTS (SELECT 1 FROM suggestions WHERE suggestion_id = ?) AS suggestion_found
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT 1;`, [+suggestionId, hangoutId, +hangoutMemberId]);
        const hangoutMemberDetails = hangoutMemberRows[0];
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
        if (hangoutMemberDetails.current_stage === constants_1.HANGOUT_AVAILABILITY_STAGE) {
            res.status(403).json({ message: `Hangout hasn't reached the suggestions stage yet.`, reason: 'inAvailabilityStage' });
            return;
        }
        ;
        if (hangoutMemberDetails.current_stage === constants_1.HANGOUT_VOTING_STAGE) {
            res.status(403).json({ message: `Suggestions can't be deleted after the suggestions stage ends.`, reason: 'inVotingStage' });
            return;
        }
        ;
        if (hangoutMemberDetails.is_concluded) {
            res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });
            return;
        }
        ;
        if (!hangoutMemberDetails.suggestion_found) {
            res.json({});
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        suggestions
      WHERE
        suggestion_id = ?;`, [+suggestionId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            return;
        }
        ;
        res.json({});
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([hangoutId], {
            type: 'suggestion',
            reason: 'suggestionDeleted',
            data: {
                hangoutMemberId: +hangoutMemberId,
                deletedSuggestionId: +suggestionId,
            },
        });
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
exports.suggestionsRouter.delete('/leader', async (req, res) => {
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
    const suggestionId = req.query.suggestionId;
    const hangoutMemberId = req.query.hangoutMemberId;
    const hangoutId = req.query.hangoutId;
    if (typeof suggestionId !== 'string' || typeof hangoutMemberId !== 'string' || typeof hangoutId !== 'string') {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(+suggestionId)) {
        res.status(400).json({ message: 'Invalid suggestion ID.' });
        return;
    }
    ;
    if (!Number.isInteger(+hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
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
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        hangouts.is_concluded,
        hangouts.current_stage,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        EXISTS (SELECT 1 FROM suggestions WHERE suggestion_id = ?) as suggestion_found
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT 1;`, [+suggestionId, hangoutId, +hangoutMemberId]);
        const hangoutMemberDetails = hangoutMemberRows[0];
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
        if (!hangoutMemberDetails.is_leader) {
            res.status(401).json({ message: `You're not the hangout leader.` });
            return;
        }
        ;
        if (hangoutMemberDetails.current_stage === constants_1.HANGOUT_AVAILABILITY_STAGE) {
            res.status(403).json({ message: `Hangout hasn't reached the suggestions stage yet.`, reason: 'inAvailabilityStage' });
            return;
        }
        ;
        if (hangoutMemberDetails.current_stage === constants_1.HANGOUT_VOTING_STAGE) {
            res.status(403).json({ message: `Suggestions can't be deleted after the suggestions stage ends.`, reason: 'inVotingStage' });
            return;
        }
        ;
        if (hangoutMemberDetails.is_concluded) {
            res.status(403).json({ message: 'Hangout has already been concluded.', reason: 'hangoutConcluded' });
            return;
        }
        ;
        if (!hangoutMemberDetails.suggestion_found) {
            res.json({});
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        suggestions
      WHERE
        suggestion_id = ?;`, [+suggestionId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            return;
        }
        ;
        res.json({});
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([hangoutId], {
            type: 'suggestion',
            reason: 'suggestionDeletedByLeader',
            data: {
                deletedSuggestionId: +suggestionId,
            },
        });
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
exports.suggestionsRouter.get('/', async (req, res) => {
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
    const hangoutId = req.query.hangoutId;
    const hangoutMemberId = req.query.hangoutMemberId;
    if (typeof hangoutId !== 'string' || typeof hangoutMemberId !== 'string') {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(+hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
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
        const [validationRows] = await db_1.dbPool.execute(`SELECT
        1
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        hangout_id = ?;`, [+hangoutMemberId, hangoutId]);
        if (validationRows.length === 0) {
            res.status(401).json({ message: 'Not a member of this hangout.', reason: 'notHangoutMember' });
            return;
        }
        ;
        const [suggestionInfoRows] = await db_1.dbPool.query(`SELECT
        suggestion_id,
        hangout_member_id,
        suggestion_title,
        suggestion_description,
        suggestion_start_timestamp,
        suggestion_end_timestamp,
        is_edited
      FROM
        suggestions
      WHERE
        hangout_id = :hangoutId;
      
      SELECT
        suggestion_like_id,
        hangout_member_id,
        suggestion_id
      FROM
        suggestion_likes
      WHERE
        hangout_id = :hangoutId;
      
      SELECT
        vote_id,
        hangout_member_id,
        suggestion_id
      FROM
        votes
      WHERE
        hangout_id = :hangoutId;`, { hangoutId });
        const suggestions = suggestionInfoRows[0];
        const suggestionLikes = suggestionInfoRows[1];
        const votes = suggestionInfoRows[2];
        const suggestionLikesMap = new Map();
        const memberLikes = [];
        for (const suggestionLike of suggestionLikes) {
            if (suggestionLike.hangout_member_id === +hangoutMemberId) {
                memberLikes.push(suggestionLike.suggestion_id);
            }
            ;
            const suggestionLikeCount = suggestionLikesMap.get(suggestionLike.suggestion_id);
            if (!suggestionLikeCount) {
                suggestionLikesMap.set(suggestionLike.suggestion_id, 1);
                continue;
            }
            ;
            suggestionLikesMap.set(suggestionLike.suggestion_id, suggestionLikeCount + 1);
        }
        ;
        const suggestionVotesMap = new Map();
        const memberVotes = [];
        for (const vote of votes) {
            if (vote.hangout_member_id === +hangoutMemberId) {
                memberVotes.push(vote.suggestion_id);
            }
            ;
            const suggestionVotesCount = suggestionVotesMap.get(vote.suggestion_id);
            if (!suggestionVotesCount) {
                suggestionVotesMap.set(vote.suggestion_id, 1);
                continue;
            }
            ;
            suggestionVotesMap.set(vote.suggestion_id, suggestionVotesCount + 1);
        }
        ;
        ;
        const countedSuggestions = [];
        for (const suggestion of suggestions) {
            const likes_count = suggestionLikesMap.get(suggestion.suggestion_id);
            const votes_count = suggestionVotesMap.get(suggestion.suggestion_id);
            countedSuggestions.push({
                ...suggestion,
                likes_count: likes_count ? likes_count : 0,
                votes_count: votes_count ? votes_count : 0,
            });
        }
        ;
        res.json({
            suggestions: countedSuggestions,
            memberLikes,
            memberVotes,
        });
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
exports.suggestionsRouter.post('/likes', async (req, res) => {
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
    const expectedKeys = ['suggestionId', 'hangoutMemberId', 'hangoutId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.suggestionId)) {
        res.status(400).json({ message: 'Invalid suggestion ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
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
        const [memberSuggestionRows] = await db_1.dbPool.execute(`SELECT
        EXISTS (
          SELECT
            1
          FROM
            hangout_members
          WHERE
            hangout_member_id = :hangoutMemberId AND
            hangout_id = :hangoutId
        ) AS is_member,

        EXISTS (
          SELECT
            1
          FROM
            suggestions
          WHERE
            suggestion_id = :suggestionId
        ) as suggestion_exists,
         
        EXISTS (
          SELECT
            1
          FROM
            suggestion_likes
          WHERE
            hangout_member_id = :hangoutMemberId AND
            suggestion_id = :suggestionId
        ) as already_liked;`, { suggestionId: requestData.suggestionId, hangoutMemberId: requestData.hangoutMemberId, hangoutId: requestData.hangoutId });
        const memberSuggestionDetails = memberSuggestionRows[0];
        if (!memberSuggestionDetails) {
            res.status(500).json({ message: 'Internal server error.' });
            return;
        }
        ;
        if (!memberSuggestionDetails.is_member) {
            res.status(401).json({ message: 'Not a member of this hangout.', reason: 'notHangoutMember' });
            return;
        }
        ;
        if (!memberSuggestionDetails.suggestion_exists) {
            res.status(404).json({ message: 'Suggestion not found.' });
            return;
        }
        ;
        if (memberSuggestionDetails.already_liked) {
            res.status(409).json({ message: 'Already liked this suggestion.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`INSERT INTO suggestion_likes (
        suggestion_id,
        hangout_member_id,
        hangout_id
      ) VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [requestData.suggestionId, requestData.hangoutMemberId, requestData.hangoutId]);
        res.json({});
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([requestData.hangoutId], {
            type: 'like',
            reason: 'likeAdded',
            data: {
                hangoutMemberId: requestData.hangoutMemberId,
                suggestionId: requestData.suggestionId,
            },
        });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ message: 'Internal server error.' });
            return;
        }
        ;
        const sqlError = err;
        if (sqlError.errno === 1062) {
            res.status(409).json({ message: 'Already liked this suggestion.' });
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
    }
    ;
});
exports.suggestionsRouter.delete('/likes', async (req, res) => {
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
    const suggestionId = req.query.suggestionId;
    const hangoutMemberId = req.query.hangoutMemberId;
    const hangoutId = req.query.hangoutId;
    if (typeof suggestionId !== 'string' || typeof hangoutMemberId !== 'string' || typeof hangoutId !== 'string') {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(+suggestionId)) {
        res.status(400).json({ message: 'Invalid suggestion ID.' });
        return;
    }
    ;
    if (!Number.isInteger(+hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
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
        const [memberSuggestionRows] = await db_1.dbPool.execute(`SELECT
        EXISTS (
          SELECT
            1
          FROM
            hangout_members
          WHERE
            hangout_member_id = :hangoutMemberId AND
            hangout_id = :hangoutId
        ) AS is_member,

        EXISTS (
          SELECT
            1
          FROM
            suggestion_likes
          WHERE
            suggestion_id = :suggestionId AND
            hangout_member_id = :hangoutMemberId
          LIMIT 1
        ) as like_exists;`, { suggestionId: +suggestionId, hangoutMemberId: +hangoutMemberId, hangoutId });
        const memberSuggestionDetails = memberSuggestionRows[0];
        if (!memberSuggestionDetails) {
            res.status(500).json({ message: 'Internal server error.' });
            return;
        }
        ;
        if (!memberSuggestionDetails.is_member) {
            res.status(401).json({ message: 'Not a member of this hangout.', reason: 'notHangoutMember' });
            return;
        }
        ;
        if (!memberSuggestionDetails.like_exists) {
            res.json({});
            return;
        }
        ;
        await db_1.dbPool.execute(`DELETE FROM
        suggestion_likes
      WHERE
        suggestion_id = ? AND
        hangout_member_id = ?;`, [suggestionId, hangoutMemberId]);
        res.json({});
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([hangoutId], {
            type: 'like',
            reason: 'likeDeleted',
            data: {
                hangoutMemberId: +hangoutMemberId,
                suggestionId: +suggestionId,
            },
        });
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
