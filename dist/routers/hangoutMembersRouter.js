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
exports.hangoutMembersRouter = void 0;
const db_1 = require("../db/db");
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const userValidation_1 = require("../util/validation/userValidation");
const requestValidation_1 = require("../util/validation/requestValidation");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const addHangoutEvent_1 = require("../util/addHangoutEvent");
const cookieUtils_1 = require("../util/cookieUtils");
const authUtils = __importStar(require("../auth/authUtils"));
const authSessions_1 = require("../auth/authSessions");
const encryptionUtils_1 = require("../util/encryptionUtils");
const constants_1 = require("../util/constants");
exports.hangoutMembersRouter = express_1.default.Router();
exports.hangoutMembersRouter.post('/joinHangout/account', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.', reason: 'invalidHangoutID' });
        return;
    }
    ;
    if (requestData.hangoutPassword && !(0, userValidation_1.isValidPassword)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password', reason: 'invalidHangoutPassword' });
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
        if (authSessionDetails.user_type === 'guest') {
            res.status(403).json({ success: false, message: `Guest accounts can't join more than one hangout.`, reason: 'guestAccount' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        ;
        const [userRows] = await connection.execute(`SELECT
        display_name,
        (SELECT COUNT(*) FROM hangout_members WHERE account_id = :userId) AS joined_hangouts_count
      FROM
        accounts
      WHERE
        account_id = :userId;`, { userId: authSessionDetails.user_id });
        if (userRows.length === 0) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        const userDetails = userRows[0];
        if (userDetails.joined_hangouts_counts >= constants_1.ONGOING_HANGOUTS_LIMIT) {
            await connection.rollback();
            res.status(409).json({
                success: false,
                message: `You've reached the limit of ${constants_1.ONGOING_HANGOUTS_LIMIT} ongoing hangouts.`,
                reason: 'hangoutsLimitReached',
            });
            return;
        }
        ;
        ;
        const [hangoutRows] = await connection.execute(`SELECT
        encrypted_password,
        member_limit,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = :hangoutId) AS member_count,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = :hangoutId AND account_id = :userId) AS already_joined
      FROM
        hangouts
      WHERE
        hangout_id = :hangoutId;`, { hangoutId: requestData.hangoutId, userId: authSessionDetails.user_id });
        if (hangoutRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails.already_joined) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Already a member of this hangout.', reason: 'alreadyJoined' });
            return;
        }
        ;
        if (hangoutDetails.encrypted_password) {
            const isCorrectHangoutPassword = requestData.hangoutPassword === (0, encryptionUtils_1.decryptPassword)(hangoutDetails.encrypted_password);
            if (!isCorrectHangoutPassword) {
                await connection.rollback();
                res.status(401).json({ success: false, message: 'Incorrect hangout password.', reason: 'hangoutPassword' });
                return;
            }
            ;
        }
        ;
        const isFull = hangoutDetails.member_count === hangoutDetails.member_limit;
        if (isFull) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Hangout full.', reason: 'hangoutFull' });
            return;
        }
        ;
        await connection.execute(`INSERT INTO hangout_members (
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [requestData.hangoutId, 'account', authSessionDetails.user_id, null, userDetails.display_name, false]);
        await connection.commit();
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
exports.hangoutMembersRouter.post('/joinHangout/guest', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'hangoutPassword', 'username', 'password', 'displayName'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.', reason: 'invalidHangoutId' });
        return;
    }
    ;
    if (requestData.hangoutPassword && !(0, userValidation_1.isValidNewPassword)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.', reason: 'invalidHangoutPassword' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidUsername)(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid username.', reason: 'invalidUsername' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPassword)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid user password.', reason: 'invalidUserPassword' });
        return;
    }
    ;
    if (requestData.username === requestData.password) {
        res.status(409).json({ success: false, message: `Password can't be identical to username.`, reason: 'passwordEqualsUsername' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidDisplayName)(requestData.displayName)) {
        res.status(400).json({ success: false, message: 'Invalid display name.', reason: 'invalidDisplayName' });
        return;
    }
    ;
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        ;
        const [hangoutRows] = await connection.execute(`SELECT
        encrypted_password,
        member_limit,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = :hangoutId) AS member_count
      FROM
        hangouts
      WHERE
        hangout_id = :hangoutId;`, { hangoutId: requestData.hangoutId });
        if (hangoutRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails.encrypted_password) {
            const isCorrectHangoutPassword = requestData.hangoutPassword === (0, encryptionUtils_1.decryptPassword)(hangoutDetails.encrypted_password);
            if (!isCorrectHangoutPassword) {
                await connection.rollback();
                res.status(401).json({ success: false, message: 'Incorrect hangout password.', reason: 'hangoutPassword' });
                return;
            }
            ;
        }
        ;
        const isFull = hangoutDetails.member_count === hangoutDetails.member_limit;
        if (isFull) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Hangout is full.', reason: 'hangoutFull' });
            return;
        }
        ;
        const [guestRows] = await connection.execute(`SELECT
        1 AS username_taken
      FROM
        guests
      WHERE
        username = ?
      LIMIT 1;`, [requestData.username]);
        if (guestRows.length > 0) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Username already taken.', reason: 'usernameTaken' });
            return;
        }
        ;
        const hashedPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const [resultSetHeader] = await connection.execute(`INSERT INTO guests (
        username,
        hashed_password,
        display_name,
        hangout_id
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [requestData.username, hashedPassword, requestData.displayName, requestData.hangoutId]);
        const guestId = resultSetHeader.insertId;
        await connection.execute(`INSERT INTO hangout_members (
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [requestData.hangoutId, 'guest', null, guestId, requestData.displayName, false]);
        await connection.commit();
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: guestId,
            user_type: 'guest',
            keepSignedIn: false,
        });
        const hourMilliseconds = 1000 * 60 * 60;
        (0, cookieUtils_1.setResponseCookie)(res, 'guestHangoutId', requestData.hangoutId, hourMilliseconds * 6, false);
        res.json({ success: true, resData: { authSessionCreated } });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
exports.hangoutMembersRouter.delete('/kick', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'memberToKickId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if ((0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.memberToKickId)) {
        res.status(400).json({ succesS: false, message: 'Invalid member to kick ID.' });
        return;
    }
    ;
    if (requestData.hangoutMemberId === requestData.memberToKickId) {
        res.status(409).json({ success: false, message: `You can't kick yourself.` });
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
        hangout_member_id,
        account_id,
        guest_id,
        display_name,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id = ?
      LIMIT ${constants_1.HANGOUT_MEMBERS_LIMIT};`, [requestData.hangoutId]);
        if (hangoutMemberRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.hangoutMemberId && member[`${authSessionDetails.user_type}_id`] === authSessionDetails.user_id);
        if (!hangoutMember) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (!hangoutMember.is_leader) {
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        const memberToKick = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.memberToKickId);
        if (!memberToKick) {
            res.status(404).json({ success: false, message: 'Member not found.' });
            return;
        }
        ;
        if (!memberToKick.account_id) {
            const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
          guests
        WHERE
          guest_id = ?;`, [memberToKick.guest_id]);
            if (resultSetHeader.affectedRows === 0) {
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
            res.json({ success: true, resData: {} });
            const eventDescription = `${memberToKick.display_name} was kicked.`;
            await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, eventDescription);
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`, [memberToKick.hangout_member_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: {} });
        const eventDescription = `${memberToKick.display_name} was kicked.`;
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, eventDescription);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutMembersRouter.delete('/leave', async (req, res) => {
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
    const expectedKeys = ['hangoutMemberId', 'hangoutId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
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
        hangout_id,
        account_id,
        guest_id,
        display_name,
        is_leader,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = ?) AS hangout_member_count
      FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`, [requestData.hangoutId, requestData.hangoutMemberId]);
        if (hangoutMemberRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (hangoutMemberDetails.hangout_id !== requestData.hangoutId) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (hangoutMemberDetails.hangout_member_count === 1) {
            const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
          hangouts
        WHERE
          hangout_id = ?;`, [requestData.hangoutId]);
            if (resultSetHeader.affectedRows === 0) {
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
            if (authSessionDetails.user_type === 'guest') {
                await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'guest');
                (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            }
            ;
            res.json({ success: true, resData: {} });
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`[requestData.hangoutMemberId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        if (authSessionDetails.user_type === 'guest') {
            await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'guest');
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        }
        ;
        res.json({ success: true, resData: {} });
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, `${hangoutMemberDetails.display_name} left the hangout.`);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutMembersRouter.patch('/transferLeadership', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'newLeaderMemberId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if ((0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.newLeaderMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid new leader hangout member ID.' });
        return;
    }
    ;
    if (requestData.hangoutMemberId === requestData.newLeaderMemberId) {
        res.status(409).json({ success: false, message: `You're already hangout leader.` });
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
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        const [hangoutMemberRows] = await connection.execute(`SELECT
        hangout_member_id,
        account_id,
        guest_id,
        display_name,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id = ?
      LIMIT ${constants_1.HANGOUT_MEMBERS_LIMIT};`, [requestData.hangoutId]);
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.hangoutMemberId && member[`${authSessionDetails.user_type}_id`] === authSessionDetails.user_id);
        if (!hangoutMember) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (!hangoutMember.is_leader) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        const newHangoutLeader = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.newLeaderMemberId);
        if (!newHangoutLeader) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Member not found.' });
            return;
        }
        ;
        const [firstResultSetHeader] = await connection.execute(`UPDATE
        hangout_members
      SET
        is_leader = ?
      WHERE
        hangout_member_id = ?;`, [false, requestData.hangoutMemberId]);
        if (firstResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const [secondResultSetHeader] = await connection.execute(`UPDATE
        hangout_members
      SET
        is_leader = ?
      WHERE
        hangout_member_id = ?;`, [true, requestData.newLeaderMemberId]);
        if (secondResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        res.json({ success: true, resData: {} });
        const eventDescription = `${hangoutMember.display_name} has appointed ${newHangoutLeader.display_name} new hangout leader.`;
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, eventDescription);
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
exports.hangoutMembersRouter.patch('/claimLeadership', async (req, res) => {
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
        res.status(404).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
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
        hangout_member_id,
        account_id,
        guest_id,
        is_leader,
        display_name
      FROM
        hangout_members
      WHERE
        hangout_id = ?
      LIMIT ${constants_1.HANGOUT_MEMBERS_LIMIT};`, [requestData.hangoutId]);
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.hangoutMemberId && member[`${authSessionDetails.user_type}_id`] === authSessionDetails.user_id);
        if (!hangoutMember) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        const currentHangoutLeader = hangoutMemberRows.find((member) => member.is_leader);
        if (currentHangoutLeader) {
            await connection.rollback();
            res.status(409).json({
                success: false,
                message: hangoutMember.hangout_member_id === currentHangoutLeader.hangout_member_id ? `You're already the hangout leader.` : 'Hangout already has a leader.',
            });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`UPDATE
        hangout_members
      SET
        is_leader = ?
      WHERE
        hangout_member_id = ?;`, [true, requestData.hangoutMemberId]);
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        res.json({ success: true, resData: {} });
        const eventDescription = `${hangoutMember.display_name} has claimed the hangout leader role.`;
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, eventDescription);
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
