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
exports.hangoutsRouter = void 0;
const db_1 = require("../db/db");
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const hangoutValidation = __importStar(require("../util/validation/hangoutValidation"));
const requestValidation_1 = require("../util/validation/requestValidation");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const userValidation_1 = require("../util/validation/userValidation");
const tokenGenerator_1 = require("../util/tokenGenerator");
const addHangoutEvent_1 = require("../util/addHangoutEvent");
const globalUtils_1 = require("../util/globalUtils");
const isSqlError_1 = require("../util/isSqlError");
const encryptionUtils_1 = require("../util/encryptionUtils");
const authUtils = __importStar(require("../auth/authUtils"));
const cookieUtils_1 = require("../util/cookieUtils");
const authSessions_1 = require("../auth/authSessions");
const constants_1 = require("../util/constants");
const hangoutWebSocketServer_1 = require("../webSockets/hangout/hangoutWebSocketServer");
const errorLogger_1 = require("../logs/errorLogger");
exports.hangoutsRouter = express_1.default.Router();
exports.hangoutsRouter.post('/create/accountLeader', async (req, res) => {
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
    const expectedKeys = ['hangoutTitle', 'hangoutPassword', 'membersLimit', 'availabilityPeriod', 'suggestionsPeriod', 'votingPeriod'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutTitle(requestData.hangoutTitle)) {
        res.status(400).json({ message: 'Invalid hangout title.', reason: 'invalidHangoutTitle' });
        return;
    }
    ;
    if (requestData.hangoutPassword && !(0, userValidation_1.isValidNewPassword)(requestData.hangoutPassword)) {
        res.status(400).json({ message: 'Invalid hangout password.', reason: 'invalidHangoutPassword' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutMembersLimit(requestData.membersLimit)) {
        res.status(400).json({ message: 'Invalid hangout members limit.', reason: 'invalidMembersLimit' });
        return;
    }
    ;
    const { availabilityPeriod, suggestionsPeriod, votingPeriod } = requestData;
    if (!hangoutValidation.isValidHangoutPeriods([availabilityPeriod, suggestionsPeriod, votingPeriod])) {
        res.status(400).json({ message: 'Invalid hangout stages configuration.', reason: 'invalidHangoutPeriods' });
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
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.display_name,
        accounts.username
      FROM
        accounts
      WHERE
        account_id = ?;`, [authSessionDetails.user_id]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        ;
        const [ongoingHangoutRows] = await db_1.dbPool.execute(`SELECT
        COUNT(*) AS ongoing_hangouts_count
      FROM
        hangout_members
      LEFT JOIN
        hangouts ON hangout_members.hangout_id = hangouts.hangout_id
      WHERE
        hangout_members.account_id = ? AND
        hangouts.is_concluded = ?;`, [authSessionDetails.user_id, false]);
        if (ongoingHangoutRows[0] && ongoingHangoutRows[0].ongoing_hangouts_count >= constants_1.MAX_ONGOING_HANGOUTS_LIMIT) {
            res.status(409).json({
                message: `You've reached the limit of ${constants_1.MAX_ONGOING_HANGOUTS_LIMIT} ongoing hangouts.`,
                reason: 'hangoutsLimitReached',
            });
            return;
        }
        ;
        const currentTimestamp = Date.now();
        const hangoutId = (0, tokenGenerator_1.generateHangoutId)(currentTimestamp);
        const encryptedHangoutPassword = requestData.hangoutPassword ? (0, encryptionUtils_1.encryptPassword)(requestData.hangoutPassword) : null;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        await connection.execute(`INSERT INTO hangouts (
        hangout_id,
        hangout_title,
        encrypted_password,
        members_limit,
        availability_period,
        suggestions_period,
        voting_period,
        current_stage,
        stage_control_timestamp,
        created_on_timestamp,
        is_concluded
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(11)});`, [hangoutId, requestData.hangoutTitle, encryptedHangoutPassword, requestData.membersLimit, availabilityPeriod, suggestionsPeriod, votingPeriod, 1, currentTimestamp, currentTimestamp, false]);
        await connection.execute(`INSERT INTO hangout_members (
        hangout_id,
        username,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(7)});`, [hangoutId, accountDetails.username, 'account', authSessionDetails.user_id, null, accountDetails.display_name, true]);
        await connection.commit();
        res.status(201).json({ hangoutId });
        await (0, addHangoutEvent_1.addHangoutEvent)(hangoutId, `${accountDetails.display_name} created the hangout.`, currentTimestamp);
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        if (res.headersSent) {
            return;
        }
        ;
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, err);
            return;
        }
        ;
        const sqlError = err;
        if (sqlError.errno === 1062) {
            res.status(409).json({ message: 'Duplicate hangout ID.', reason: 'duplicateHangoutId' });
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.hangoutsRouter.post('/create/guestLeader', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutTitle', 'hangoutPassword', 'membersLimit', 'availabilityPeriod', 'suggestionsPeriod', 'votingPeriod', 'username', 'password', 'displayName'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutTitle(requestData.hangoutTitle)) {
        res.status(400).json({ message: 'Invalid hangout title.', reason: 'invalidHangoutTitle' });
        return;
    }
    ;
    if (requestData.hangoutPassword && !(0, userValidation_1.isValidNewPassword)(requestData.hangoutPassword)) {
        res.status(400).json({ message: 'Invalid hangout password.', reason: 'invalidHangoutPassword' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutMembersLimit(requestData.membersLimit)) {
        res.status(400).json({ message: 'Invalid hangout members limit.', reason: 'invalidMembersLimit' });
        return;
    }
    ;
    const { availabilityPeriod, suggestionsPeriod, votingPeriod } = requestData;
    if (!hangoutValidation.isValidHangoutPeriods([availabilityPeriod, suggestionsPeriod, votingPeriod])) {
        res.status(400).json({ message: 'Invalid hangout stages configuration.', reason: 'invalidHangoutPeriods' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidUsername)(requestData.username)) {
        res.status(400).json({ message: 'Invalid guest username.', reason: 'invalidUsername' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPassword)(requestData.password)) {
        res.status(400).json({ message: 'Invalid guest password.', reason: 'invalidGuestPassword' });
        return;
    }
    ;
    if (requestData.username === requestData.password) {
        res.status(409).json({ message: `Password can't be identical to username.`, reason: 'passwordEqualsUsername' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidDisplayName)(requestData.displayName)) {
        res.status(400).json({ message: 'Invalid guest display name.', reason: 'invalidDisplayName' });
        return;
    }
    ;
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        const [guestRows] = await connection.execute(`(SELECT 1 AS taken_status FROM accounts WHERE username = :username LIMIT 1)
      UNION ALL
      (SELECT 1 AS taken_status FROM guests WHERE username = :username LIMIT 1);`, { username: requestData.username });
        if (guestRows.length > 0) {
            await connection.rollback();
            res.status(409).json({ message: 'Username is already taken.', reason: 'guestUsernameTaken' });
            return;
        }
        ;
        const currentTimestamp = Date.now();
        const hangoutId = (0, tokenGenerator_1.generateHangoutId)(currentTimestamp);
        const encryptedHangoutPassword = requestData.hangoutPassword ? (0, encryptionUtils_1.encryptPassword)(requestData.hangoutPassword) : null;
        await connection.execute(`INSERT INTO hangouts (
        hangout_id,
        hangout_title,
        encrypted_password,
        members_limit,
        availability_period,
        suggestions_period,
        voting_period,
        current_stage,
        stage_control_timestamp,
        created_on_timestamp,
        is_concluded
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(11)});`, [hangoutId, requestData.hangoutTitle, encryptedHangoutPassword, requestData.membersLimit, availabilityPeriod, suggestionsPeriod, votingPeriod, 1, currentTimestamp, currentTimestamp, false]);
        const hashedGuestPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const [resultSetHeader] = await connection.execute(`INSERT INTO guests (
        username,
        hashed_password,
        display_name,
        hangout_id
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(4)});`, [requestData.username, hashedGuestPassword, requestData.displayName, hangoutId]);
        const guestId = resultSetHeader.insertId;
        await connection.execute(`INSERT INTO hangout_members (
        hangout_id,
        username,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(7)});`, [hangoutId, requestData.username, 'guest', null, guestId, requestData.displayName, true]);
        await connection.commit();
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: guestId,
            user_type: 'guest',
            keepSignedIn: false,
        });
        if (authSessionCreated) {
            (0, cookieUtils_1.setResponseCookie)(res, 'guestHangoutId', hangoutId, constants_1.hourMilliseconds * 6, false);
        }
        ;
        res.status(201).json({ authSessionCreated, hangoutId });
        await (0, addHangoutEvent_1.addHangoutEvent)(hangoutId, `${requestData.displayName} created the hangout.`, currentTimestamp);
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        if (res.headersSent) {
            return;
        }
        ;
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, err);
            return;
        }
        ;
        const sqlError = err;
        if (sqlError.errno === 1062) {
            res.status(409).json({ message: 'Duplicate hangout ID.', reason: 'duplicateHangoutId' });
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.hangoutsRouter.patch('/details/updatePassword', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'newPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (requestData.newPassword && !(0, userValidation_1.isValidNewPassword)(requestData.newPassword)) {
        res.status(400).json({ message: 'Invalid new hangout password.', reason: 'invalidPassword' });
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
        hangout_members.hangout_id,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        hangouts.is_concluded,
        hangouts.encrypted_password
      FROM
        hangout_members
      LEFT JOIN
        hangouts ON hangout_members.hangout_id = hangouts.hangout_id
      WHERE
        hangout_members.hangout_member_id = ?;`, [requestData.hangoutMemberId]);
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (!hangoutMemberDetails) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
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
        if (!hangoutMemberDetails.is_leader) {
            res.status(401).json({ message: `You're not the hangout leader.`, reason: 'notHangoutLeader' });
            return;
        }
        ;
        if (hangoutMemberDetails.is_concluded) {
            res.status(403).json({ message: 'Hangout has already been concluded.' });
            return;
        }
        ;
        if (!hangoutMemberDetails.encrypted_password && !requestData.newPassword) {
            res.json({});
            return;
        }
        ;
        const newEncryptedPassword = requestData.newPassword ? (0, encryptionUtils_1.encryptPassword)(requestData.newPassword) : null;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        hangouts
      SET
        encrypted_password = ?
      WHERE
        hangout_id = ?;`, [newEncryptedPassword, requestData.hangoutId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        res.json({});
        const isPasswordProtected = requestData.newPassword ? true : false;
        const eventTimestamp = Date.now();
        const eventDescription = `Hangout password ${isPasswordProtected ? 'updated' : 'removed'}.`;
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, eventDescription, eventTimestamp);
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([requestData.hangoutId], {
            type: 'hangout',
            reason: 'passwordUpdated',
            data: {
                isPasswordProtected,
                eventTimestamp,
                eventDescription,
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
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.hangoutsRouter.patch('/details/updateTitle', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'newTitle'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutTitle(requestData.newTitle)) {
        res.status(400).json({ message: 'Invalid new hangout title.', reason: 'invalidNewTitle' });
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
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangouts.hangout_title,
        hangouts.is_concluded,
        hangout_members.is_leader,
        hangout_members.account_id,
        hangout_members.guest_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?`, [requestData.hangoutId, requestData.hangoutMemberId]);
        const hangoutDetails = hangoutRows[0];
        if (!hangoutDetails) {
            res.status(404).json({ message: 'Hangout not found.' });
            return;
        }
        ;
        if (hangoutDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (!hangoutDetails.is_leader) {
            res.status(401).json({ message: `You're not the hangout leader.`, reason: 'notHangoutLeader' });
            return;
        }
        ;
        if (hangoutDetails.is_concluded) {
            res.status(403).json({ message: 'Hangout has already been concluded.' });
            return;
        }
        ;
        if (hangoutDetails.hangout_title === requestData.newTitle) {
            res.status(409).json({ message: 'Hangout already has this title.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        hangouts
      SET
        hangout_title = ?
      WHERE
        hangout_id = ?;`, [requestData.newTitle, requestData.hangoutId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        res.json({});
        const eventTimestamp = Date.now();
        const eventDescription = `Hangout title was updated to: ${requestData.newTitle}.`;
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, eventDescription, eventTimestamp);
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([requestData.hangoutId], {
            type: 'hangout',
            reason: 'titleUpdated',
            data: {
                newTitle: requestData.newTitle,
                eventTimestamp,
                eventDescription,
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
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.hangoutsRouter.patch('/details/updateMembersLimit', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'newMembersLimit'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutMembersLimit(requestData.newMembersLimit)) {
        res.status(409).json({ message: 'Invalid new members limit.' });
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
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        const [hangoutRows] = await connection.execute(`SELECT
        hangouts.members_limit,
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = :hangoutId) AS current_member_count
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = :hangoutId AND
        hangout_members.hangout_member_id = :hangoutMemberId
      LIMIT 1;`, { hangoutId: requestData.hangoutId, hangoutMemberId: requestData.hangoutMemberId });
        const hangoutDetails = hangoutRows[0];
        if (!hangoutDetails) {
            await connection.rollback();
            res.status(404).json({ message: 'Hangout not found.' });
            return;
        }
        ;
        if (hangoutDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            await connection.rollback();
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (!hangoutDetails.is_leader) {
            await connection.rollback();
            res.status(401).json({ message: `You're not the hangout leader.`, reason: 'notHangoutLeader' });
            return;
        }
        ;
        if (hangoutDetails.is_concluded) {
            await connection.rollback();
            res.status(403).json({ message: 'Hangout has already been concluded.' });
            return;
        }
        ;
        if (hangoutDetails.members_limit === requestData.newMembersLimit) {
            await connection.rollback();
            res.json({});
            return;
        }
        ;
        if (requestData.newMembersLimit < hangoutDetails.current_member_count) {
            await connection.rollback();
            res.status(409).json({ message: `New members limit can't be lower than the number of existing members.` });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`UPDATE
        hangouts
      SET
        members_limit = ?
      WHERE
        hangout_id = ?;`, [requestData.newMembersLimit, requestData.hangoutId]);
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        await connection.commit();
        res.json({});
        const eventTimestamp = Date.now();
        const eventDescription = `Hangout members limit was updated to ${requestData.newMembersLimit}.`;
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, eventDescription, eventTimestamp);
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([requestData.hangoutId], {
            type: 'hangout',
            reason: 'memberLimitUpdated',
            data: {
                newMemberLimit: requestData.newMembersLimit,
                eventTimestamp,
                eventDescription,
            },
        });
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, eventDescription);
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.hangoutsRouter.patch('/details/stages/update', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'newAvailabilityPeriod', 'newSuggestionsPeriod', 'newVotingPeriod'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
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
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        ;
        const [hangoutRows] = await connection.execute(`SELECT
        hangouts.availability_period,
        hangouts.suggestions_period,
        hangouts.voting_period,
        hangouts.current_stage,
        hangouts.stage_control_timestamp,
        hangouts.created_on_timestamp,
        hangouts.is_concluded,
        hangout_members.hangout_member_id,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT 1;`, [requestData.hangoutId, requestData.hangoutMemberId]);
        const hangoutDetails = hangoutRows[0];
        if (!hangoutDetails) {
            await connection.rollback();
            res.status(404).json({ message: 'Hangout not found.' });
            return;
        }
        ;
        if (hangoutDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            await connection.rollback();
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (!hangoutDetails.is_leader) {
            await connection.rollback();
            res.status(401).json({ message: `You're not the hangout leader.`, reason: 'notHangoutLeader' });
            return;
        }
        ;
        if (hangoutDetails.is_concluded) {
            await connection.rollback();
            res.status(403).json({ message: 'Hangout has already been concluded.' });
            return;
        }
        ;
        if (!hangoutValidation.isValidNewHangoutPeriods({ currentStage: hangoutDetails.current_stage, stageControlTimestamp: hangoutDetails.stage_control_timestamp }, [hangoutDetails.availability_period, hangoutDetails.suggestions_period, hangoutDetails.voting_period], [requestData.newAvailabilityPeriod, requestData.newSuggestionsPeriod, requestData.newVotingPeriod])) {
            await connection.rollback();
            res.status(409).json({ message: 'Invalid new hangout stages configuration.' });
            return;
        }
        ;
        const [firstResultSetHeader] = await connection.execute(`UPDATE
        hangouts
      SET
        availability_period = ?,
        suggestions_period = ?,
        voting_period = ?
      WHERE
        hangout_id = ?;`, [requestData.newAvailabilityPeriod, requestData.newSuggestionsPeriod, requestData.newVotingPeriod, requestData.hangoutId]);
        if (firstResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        const previousConclusionTimestamp = hangoutDetails.created_on_timestamp + hangoutDetails.availability_period + hangoutDetails.suggestions_period + hangoutDetails.voting_period;
        const newConclusionTimestamp = hangoutDetails.created_on_timestamp + requestData.newAvailabilityPeriod + requestData.newSuggestionsPeriod + requestData.newVotingPeriod;
        await connection.commit();
        res.json({ newConclusionTimestamp });
        if (newConclusionTimestamp > previousConclusionTimestamp) {
            await connection.query(`DELETE FROM
          availability_slots
        WHERE
          slot_start_timestamp < :newConclusionTimestamp AND
          hangout_id = :hangoutId;
        
        DELETE FROM
          suggestions
        WHERE
          suggestion_start_timestamp < :newConclusionTimestamp AND
          hangout_id = :hangoutId;`, { newConclusionTimestamp, hangoutId: requestData.hangoutId });
        }
        ;
        const eventTimestamp = Date.now();
        const eventDescription = `Hangout stages have been updated. The hangout will now be concluded on ${(0, globalUtils_1.getDateAndTimeString)(newConclusionTimestamp)} as a result.`;
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, eventDescription, eventTimestamp);
        const { newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod } = requestData;
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([requestData.hangoutId], {
            type: 'hangout',
            reason: 'hangoutStagesUpdated',
            data: {
                newAvailabilityPeriod,
                newSuggestionsPeriod,
                newVotingPeriod,
                eventTimestamp,
                eventDescription,
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
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.hangoutsRouter.patch('/details/stages/progress', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
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
        const [hangoutRows] = await connection.execute(`SELECT
        hangouts.current_stage,
        hangouts.stage_control_timestamp,
        hangouts.is_concluded,
        hangout_members.hangout_member_id,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        (SELECT COUNT(*) FROM suggestions WHERE hangout_id = :hangoutId) AS suggestions_count
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = :hangoutId AND
        hangout_members.hangout_member_id = :hangoutMemberId
      LIMIT 1;`, { hangoutId: requestData.hangoutId, hangoutMemberId: requestData.hangoutMemberId });
        const hangoutDetails = hangoutRows[0];
        if (!hangoutDetails) {
            await connection.rollback();
            res.status(404).json({ message: 'Hangout not found.' });
            return;
        }
        ;
        if (hangoutDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            await connection.rollback();
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (!hangoutDetails.is_leader) {
            await connection.rollback();
            res.status(401).json({ message: `You're not the hangout leader.`, reason: 'notHangoutLeader' });
            return;
        }
        ;
        if (hangoutDetails.is_concluded) {
            await connection.rollback();
            res.status(403).json({ message: 'Hangout has already been concluded.' });
            return;
        }
        ;
        if (hangoutDetails.current_stage === constants_1.HANGOUT_SUGGESTIONS_STAGE && hangoutDetails.suggestions_count === 0) {
            await connection.rollback();
            res.status(409).json({ message: `Can't progress the hangout without any suggestions.` });
            return;
        }
        ;
        const currentTimestamp = Date.now();
        const updatedCurrentStagePeriod = currentTimestamp - hangoutDetails.stage_control_timestamp;
        const [resultSetHeader] = await connection.execute(`UPDATE
        hangouts
      SET
        availability_period = CASE
          WHEN current_stage = ${constants_1.HANGOUT_AVAILABILITY_STAGE} THEN :updatedCurrentStagePeriod
          ELSE availability_period
        END,
        suggestions_period = CASE
          WHEN current_stage = ${constants_1.HANGOUT_SUGGESTIONS_STAGE} THEN :updatedCurrentStagePeriod
          ELSE suggestions_period
        END,
        voting_period = CASE
          WHEN current_stage = ${constants_1.HANGOUT_VOTING_STAGE} THEN :updatedCurrentStagePeriod
          ELSE voting_period
        END,
        is_concluded = CASE
          WHEN current_stage = ${constants_1.HANGOUT_VOTING_STAGE} THEN TRUE
          ELSE is_concluded
        END,
        current_stage = current_stage + 1,
        stage_control_timestamp = :currentTimestamp
      WHERE
        hangout_id = :hangoutId;`, { updatedCurrentStagePeriod, currentTimestamp, hangoutId: requestData.hangoutId });
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        ;
        const [updatedHangoutRows] = await connection.execute(`SELECT
        availability_period,
        suggestions_period,
        voting_period,
        (created_on_timestamp + availability_period + suggestions_period + voting_period) AS conclusion_timestamp,
        stage_control_timestamp,
        current_stage,
        is_concluded
      FROM
        hangouts
      WHERE
        hangout_id = ?;`, [requestData.hangoutId]);
        const updatedHangoutDetails = updatedHangoutRows[0];
        if (!updatedHangoutDetails) {
            await connection.rollback();
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to fetch rows.', trace: null });
            return;
        }
        ;
        await connection.commit();
        res.json(updatedHangoutDetails);
        const eventDescription = updatedHangoutDetails.is_concluded
            ? 'Hangout has been manually concluded.'
            : `Hangout has been manually progressed, and will now be concluded on ${(0, globalUtils_1.getDateAndTimeString)(updatedHangoutDetails.conclusion_timestamp)} as a result.`;
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, eventDescription, currentTimestamp);
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([requestData.hangoutId], {
            type: 'hangout',
            reason: 'hangoutManuallyProgressed',
            data: {
                updatedHangoutDetails: {
                    ...updatedHangoutDetails,
                    is_concluded: Boolean(updatedHangoutDetails.is_concluded),
                },
                eventTimestamp: currentTimestamp,
                eventDescription,
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
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.hangoutsRouter.delete('/', async (req, res) => {
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
    const hangoutMemberId = req.query.hangoutMemberId;
    const hangoutId = req.query.hangoutId;
    if (typeof hangoutMemberId !== 'string' || typeof hangoutId !== 'string') {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(+hangoutMemberId)) {
        res.status(400).json({ message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(hangoutId)) {
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
        account_id,
        guest_id,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        hangout_id = ?;`, [+hangoutMemberId, hangoutId]);
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
            res.status(401).json({ message: 'Not hangout leader.', reason: 'notHangoutLeader' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        hangouts
      WHERE
        hangout_id = ?;`, [hangoutId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to delete rows.', trace: null });
            return;
        }
        ;
        res.json({});
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.hangoutsRouter.get('/details/hangoutExists', async (req, res) => {
    const hangoutId = req.query.hangoutId;
    if (typeof hangoutId !== 'string' || !hangoutValidation.isValidHangoutId(hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
        return;
    }
    ;
    try {
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        encrypted_password
      FROM
        hangouts
      WHERE
        hangout_id = :hangoutId;`, { hangoutId });
        const hangoutDetails = hangoutRows[0];
        if (!hangoutDetails) {
            res.status(404).json({ message: 'Hangout not found.' });
            return;
        }
        ;
        const isPasswordProtected = Boolean(hangoutDetails.encrypted_password);
        res.json({ isPasswordProtected });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.hangoutsRouter.get('/details/initial', async (req, res) => {
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
    if (typeof hangoutId !== 'string') {
        res.status(400).json({ message: 'Invalid hangout ID.', reason: 'hangoutId' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.', reason: 'hangoutId' });
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
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangouts.is_concluded,
        hangouts.encrypted_password,
        hangouts.members_limit,
        hangout_members.hangout_member_id,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?;`, [hangoutId]);
        const hangoutInfo = hangoutRows[0];
        if (!hangoutInfo) {
            res.status(404).json({ message: 'Hangout not found.' });
            return;
        }
        ;
        const isPasswordProtected = Boolean(hangoutInfo.encrypted_password);
        const isFull = hangoutRows.length === hangoutInfo.members_limit;
        const requesterHangoutMemberDetails = hangoutRows.find((member) => member[`${authSessionDetails.user_type}_id`] === authSessionDetails.user_id);
        if (!requesterHangoutMemberDetails) {
            res.status(401).json({
                message: 'Not a member of this hangout.',
                reason: 'notMember',
                resData: {
                    isConcluded: Boolean(hangoutInfo.is_concluded),
                    isPasswordProtected,
                    isFull: isPasswordProtected ? null : isFull,
                },
            });
            return;
        }
        ;
        const [hangoutData] = await db_1.dbPool.query(`SELECT
        hangout_title,
        members_limit,
        availability_period,
        suggestions_period,
        voting_period,
        current_stage,
        stage_control_timestamp,
        created_on_timestamp,
        is_concluded
      FROM
        hangouts
      WHERE
        hangout_id = :hangoutId;

      SELECT
        hangout_members.hangout_member_id,
        hangout_members.username,
        hangout_members.user_type,
        hangout_members.account_id,
        hangout_members.display_name,
        hangout_members.is_leader,
        EXISTS (SELECT 1 FROM friendships WHERE account_id = hangout_members.account_id AND friend_id = :accountId) AS is_friend
      FROM
        hangout_members
      WHERE
        hangout_members.hangout_id = :hangoutId;

      SELECT
        (SELECT COUNT(*) FROM availability_slots WHERE hangout_member_id = :hangoutMemberId) AS availability_slots_count,
        (SELECT COUNT(*) FROM suggestions WHERE hangout_member_id = :hangoutMemberId) AS suggestions_count,
        (SELECT COUNT(*) FROM votes WHERE hangout_member_id = :hangoutMemberId) AS votes_count;
      
      SELECT
        message_id,
        hangout_member_id,
        message_content,
        message_timestamp
      FROM
        chat
      WHERE
        hangout_id = :hangoutId
      ORDER BY
        message_timestamp DESC
      LIMIT 2;
      
      SELECT
        event_description,
        event_timestamp
      FROM
        hangout_events
      WHERE
        hangout_id = :hangoutId
      ORDER BY
        event_timestamp DESC
      LIMIT 2;`, { hangoutId, hangoutMemberId: requesterHangoutMemberDetails.hangout_member_id, accountId: authSessionDetails.user_type === 'guest' ? 0 : authSessionDetails.user_id });
        if (hangoutData.length !== 5) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to fetch rows.', trace: null });
            return;
        }
        ;
        const hangoutDetails = hangoutData[0][0];
        const hangoutMembers = hangoutData[1];
        const hangoutMemberCountables = hangoutData[2][0];
        const latestChatMessages = hangoutData[3];
        const latestHangoutEvents = hangoutData[4];
        if (!hangoutDetails || !hangoutMemberCountables) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to fetch rows.', trace: null });
            return;
        }
        ;
        let decryptedHangoutPassword = null;
        if (hangoutInfo.encrypted_password && requesterHangoutMemberDetails.is_leader) {
            decryptedHangoutPassword = (0, encryptionUtils_1.decryptPassword)(hangoutInfo.encrypted_password);
        }
        ;
        const { created_on_timestamp, availability_period, suggestions_period, voting_period } = hangoutDetails;
        const conclusionTimestamp = created_on_timestamp + availability_period + suggestions_period + voting_period;
        res.json({
            hangoutMemberId: requesterHangoutMemberDetails.hangout_member_id,
            isLeader: requesterHangoutMemberDetails.is_leader,
            isPasswordProtected,
            decryptedHangoutPassword,
            conclusionTimestamp,
            hangoutDetails,
            hangoutMembers,
            hangoutMemberCountables,
            latestChatMessages,
            latestHangoutEvents,
        });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.hangoutsRouter.get('/events', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
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
    if (!hangoutValidation.isValidHangoutId(hangoutId)) {
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
        const [isMemberRows] = await db_1.dbPool.execute(`SELECT
        1
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        hangout_id = ?`, [+hangoutMemberId, hangoutId]);
        if (isMemberRows.length === 0) {
            res.status(404).json({ message: 'Hangout not found.' });
            return;
        }
        ;
        const [hangoutEvents] = await db_1.dbPool.execute(`SELECT
        event_description,
        event_timestamp
      FROM
        hangout_events
      WHERE
        hangout_id = ?
      ORDER BY
        event_timestamp DESC;`, [hangoutId]);
        res.json(hangoutEvents);
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
