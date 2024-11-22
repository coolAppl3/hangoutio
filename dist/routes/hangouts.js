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
const hangoutUtils = __importStar(require("../util/hangoutUtils"));
const requestValidation_1 = require("../util/validation/requestValidation");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const userValidation_1 = require("../util/validation/userValidation");
const tokenGenerator_1 = require("../util/tokenGenerator");
const userUtils_1 = require("../util/userUtils");
const hangoutLogger_1 = require("../util/hangoutLogger");
const globalUtils_1 = require("../util/globalUtils");
const isSqlError_1 = require("../util/isSqlError");
const encryptionUtils_1 = require("../util/encryptionUtils");
exports.hangoutsRouter = express_1.default.Router();
exports.hangoutsRouter.post('/create/accountLeader', async (req, res) => {
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
    const accountId = (0, userUtils_1.getUserId)(authToken);
    const requestData = req.body;
    const expectedKeys = ['hangoutTitle', 'hangoutPassword', 'memberLimit', 'availabilityStep', 'suggestionsStep', 'votingStep'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutTitle(requestData.hangoutTitle)) {
        res.status(400).json({ success: false, message: 'Invalid hangout title.', reason: 'hangoutTitle' });
        return;
    }
    ;
    if (requestData.hangoutPassword !== null && !(0, userValidation_1.isValidNewPassword)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.', reason: 'hangoutPassword' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutMemberLimit(requestData.memberLimit)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member limit.', reason: 'memberLimit' });
        return;
    }
    ;
    const { availabilityStep, suggestionsStep, votingStep } = requestData;
    if (!hangoutValidation.isValidHangoutSteps(1, [availabilityStep, suggestionsStep, votingStep])) {
        res.status(400).json({ success: false, message: 'Invalid hangout steps duration.', reason: 'hangoutSteps' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        auth_token,
        display_name
      FROM
        accounts
      WHERE
        account_id = ?;`, [accountId]);
        if (accountRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const accountDetails = accountRows[0];
        if (authToken !== accountDetails.auth_token) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const [ongoingHangoutsRows] = await db_1.dbPool.execute(`SELECT
        hangouts.hangout_id,
        hangout_members.hangout_member_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.is_concluded = ? AND
        hangout_members.account_id = ?
      LIMIT ${hangoutValidation.ongoingHangoutsLimit};`, [false, accountId]);
        if (ongoingHangoutsRows.length >= hangoutValidation.ongoingHangoutsLimit) {
            res.status(409).json({
                success: false,
                message: `You've reached the limit of ${hangoutValidation.ongoingHangoutsLimit} ongoing hangouts.`,
                reason: 'hangoutsLimitReached',
            });
            return;
        }
        ;
        const createdOnTimestamp = Date.now();
        const hangoutId = (0, tokenGenerator_1.generateHangoutId)(createdOnTimestamp);
        const encryptedPassword = requestData.hangoutPassword ? (0, encryptionUtils_1.encryptPassword)(requestData.hangoutPassword) : null;
        const nextStepTimestamp = createdOnTimestamp + availabilityStep;
        const conclusionTimestamp = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        await connection.execute(`INSERT INTO hangouts(
        hangout_id,
        hangout_title,
        encrypted_password,
        member_limit,
        availability_step,
        suggestions_step,
        voting_step,
        current_step,
        current_step_timestamp,
        next_step_timestamp,
        created_on_timestamp,
        conclusion_timestamp,
        is_concluded
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(13)});`, [hangoutId, requestData.hangoutTitle, encryptedPassword, requestData.memberLimit, availabilityStep, suggestionsStep, votingStep, 1, createdOnTimestamp, nextStepTimestamp, createdOnTimestamp, conclusionTimestamp, false]);
        await connection.execute(`INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [hangoutId, 'account', accountId, null, accountDetails.display_name, true]);
        await connection.commit();
        res.status(201).json({ success: true, resData: { hangoutId } });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const sqlError = err;
        if (sqlError.errno === 1062) {
            res.status(409).json({ success: false, message: 'Duplicate hangout ID.', reason: 'duplicateHangoutId' });
            return;
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
exports.hangoutsRouter.post('/create/guestLeader', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutTitle', 'hangoutPassword', 'memberLimit', 'availabilityStep', 'suggestionsStep', 'votingStep', 'username', 'password', 'displayName'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutTitle(requestData.hangoutTitle)) {
        res.status(400).json({ success: false, message: 'Invalid hangout title.', reason: 'hangoutTitle' });
        return;
    }
    ;
    if (requestData.hangoutPassword !== null && !(0, userValidation_1.isValidNewPassword)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.', reason: 'hangoutPassword' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutMemberLimit(requestData.memberLimit)) {
        res.status(400).json({ success: false, message: 'Invalid member limit.', reason: 'memberLimit' });
        return;
    }
    ;
    const { availabilityStep, suggestionsStep, votingStep } = requestData;
    if (!hangoutValidation.isValidHangoutSteps(1, [availabilityStep, suggestionsStep, votingStep])) {
        res.status(400).json({ success: false, message: 'Invalid hangout steps duration.', reason: 'hangoutSteps' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidDisplayName)(requestData.displayName)) {
        res.status(400).json({ success: false, message: 'Invalid guest display name.', reason: 'guestDisplayName' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidUsername)(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid guest username.', reason: 'username' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPassword)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid guest password.', reason: 'guestPassword' });
        return;
    }
    ;
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        const [guestRows] = await connection.execute(`SELECT
        1
      FROM
        guests
      WHERE
        username = ?
      LIMIT 1;`, [requestData.username]);
        if (guestRows.length > 0) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Username already taken.', reason: 'guestUsernameTaken' });
            return;
        }
        ;
        const createdOnTimestamp = Date.now();
        const hangoutId = (0, tokenGenerator_1.generateHangoutId)(createdOnTimestamp);
        const encryptedPassword = requestData.hangoutPassword ? (0, encryptionUtils_1.encryptPassword)(requestData.hangoutPassword) : null;
        const nextStepTimestamp = createdOnTimestamp + availabilityStep;
        const conclusionTimestamp = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;
        await connection.execute(`INSERT INTO hangouts(
        hangout_id,
        hangout_title,
        encrypted_password,
        member_limit,
        availability_step,
        suggestions_step,
        voting_step,
        current_step,
        current_step_timestamp,
        next_step_timestamp,
        created_on_timestamp,
        conclusion_timestamp,
        is_concluded
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(13)});`, [hangoutId, requestData.hangoutTitle, encryptedPassword, requestData.memberLimit, availabilityStep, suggestionsStep, votingStep, 1, createdOnTimestamp, nextStepTimestamp, createdOnTimestamp, conclusionTimestamp, false]);
        const authToken = (0, tokenGenerator_1.generateAuthToken)('guest');
        const hashedGuestPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const [firstResultSetHeader] = await connection.execute(`INSERT INTO guests(
        auth_token,
        username,
        hashed_password,
        display_name,
        hangout_id
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [authToken, requestData.username, hashedGuestPassword, requestData.displayName, hangoutId]);
        const guestId = firstResultSetHeader.insertId;
        const idMarkedAuthToken = `${authToken}_${guestId}`;
        const [secondResultSetHeader] = await connection.execute(`UPDATE
        guests
      SET
        auth_token = ?
      WHERE
        guest_id = ?;`, [idMarkedAuthToken, guestId]);
        if (secondResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.execute(`INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [hangoutId, 'guest', null, guestId, requestData.displayName, true]);
        await connection.commit();
        res.status(201).json({ success: true, resData: { hangoutId, authToken: idMarkedAuthToken } });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const sqlError = err;
        if (sqlError.errno === 1062) {
            res.status(409).json({ success: false, message: 'Duplicate hangout ID.', reason: 'duplicateHangoutId' });
            return;
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
exports.hangoutsRouter.patch('/details/updatePassword', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'newPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPassword)(requestData.newPassword)) {
        res.status(400).json({ success: false, message: 'Invalid new hangout password.' });
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
        hangouts.encrypted_password,
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
        if (hangoutRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails[`${userType}_id`] !== userId) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (!hangoutDetails.is_leader) {
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        if (hangoutDetails.encrypted_password && requestData.newPassword === (0, encryptionUtils_1.decryptPassword)(hangoutDetails.encrypted_password)) {
            res.status(409).json({ success: false, message: 'Identical password.' });
            return;
        }
        ;
        const newEncryptedPassword = (0, encryptionUtils_1.encryptPassword)(requestData.newPassword);
        if (!newEncryptedPassword) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        hangouts
      SET
        encrypted_password = ?
      WHERE
        hangout_id = ?;`, [newEncryptedPassword, requestData.hangoutId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: {} });
        const logDescription = 'Hangout password was updated.';
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutId, logDescription);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutsRouter.patch('/details/changeMemberLimit', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'newLimit'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
        res.status(400).json({ success: 'false', message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutMemberLimit(requestData.newLimit)) {
        res.status(409).json({ success: false, message: 'Invalid new member limit.' });
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
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        const [hangoutMemberRows] = await connection.execute(`SELECT
        hangouts.member_limit,
        hangout_members.hangout_member_id,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutId]);
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.hangoutMemberId && member[`${userType}_id`] === userId);
        if (!hangoutMember) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (!hangoutMember.is_leader) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        if (hangoutMemberRows[0].member_limit === requestData.newLimit) {
            await connection.rollback();
            res.status(409).json({ success: false, message: `Member limit identical.` });
            return;
        }
        ;
        const numberOfCurrentMembers = hangoutMemberRows.length;
        if (requestData.newLimit < numberOfCurrentMembers) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'New member limit is less than the number of existing members.' });
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`UPDATE
        hangouts
      SET
        member_limit = ?
      WHERE
        hangout_id = ?;`, [requestData.newLimit, requestData.hangoutId]);
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        res.json({ success: true, resData: {} });
        const logDescription = `Hangout member limit was changed to ${requestData.newLimit}.`;
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutId, logDescription);
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
exports.hangoutsRouter.patch('/details/steps/update', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'newAvailabilityStep', 'newSuggestionsStep', 'newVotingStep'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutStep(requestData.newAvailabilityStep) ||
        !hangoutValidation.isValidHangoutStep(requestData.newSuggestionsStep) ||
        !hangoutValidation.isValidHangoutStep(requestData.newVotingStep)) {
        res.status(400).json({ success: false, message: 'Invalid hangout steps.' });
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
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        ;
        const [hangoutRows] = await connection.execute(`SELECT
        hangouts.availability_step,
        hangouts.suggestions_step,
        hangouts.voting_step,
        hangouts.current_step,
        hangouts.current_step_timestamp,
        hangouts.next_step_timestamp,
        hangouts.created_on_timestamp,
        hangouts.is_concluded,
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
        if (hangoutRows.length === 0) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails[`${userType}_id`] !== userId) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (!hangoutDetails.is_leader) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        if (hangoutDetails.is_concluded) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Hangout already concluded.' });
            return;
        }
        ;
        const { newAvailabilityStep, newSuggestionsStep, newVotingStep } = requestData;
        if (!hangoutValidation.isValidHangoutSteps(hangoutDetails.current_step, [newAvailabilityStep, newSuggestionsStep, newVotingStep])) {
            await connection.rollback();
            res.status(400).json({ success: false, message: 'Invalid mew hangout steps.' });
            return;
        }
        ;
        ;
        const newSteps = {
            newAvailabilityStep,
            newSuggestionsStep,
            newVotingStep,
        };
        if (!hangoutValidation.isValidNewHangoutSteps(hangoutDetails, newSteps)) {
            await connection.rollback();
            res.status(400).json({ success: false, message: 'Invalid new hangout steps.' });
            return;
        }
        ;
        const newConclusionTimestamp = hangoutDetails.created_on_timestamp + newAvailabilityStep + newSuggestionsStep + newVotingStep;
        const newNextStepTimestamp = hangoutUtils.getNextStepTimestamp(hangoutDetails.current_step, hangoutDetails.current_step_timestamp, hangoutDetails.availability_step, hangoutDetails.suggestions_step, hangoutDetails.voting_step);
        const [firstResultSetHeader] = await connection.execute(`UPDATE
        hangouts
      SET
        availability_step = ?,
        suggestions_step = ?,
        voting_step = ?,
        next_step_timestamp = ?,
        conclusion_timestamp = ?
      WHERE
        hangout_id = ?;`, [newAvailabilityStep, newSuggestionsStep, newVotingStep, newNextStepTimestamp, newConclusionTimestamp, requestData.hangoutId]);
        if (firstResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const yearMilliseconds = 1000 * 60 * 60 * 24 * 365;
        const [secondResultSetHeader] = await connection.execute(`DELETE FROM
        availability_slots
      WHERE
        hangout_id = ? AND
        (slot_start_timestamp < ? OR slot_start_timestamp > ?);`, [requestData.hangoutId, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]);
        const [thirdResultSetheader] = await connection.execute(`DELETE FROM
        suggestions
      WHERE
        hangout_id = ? AND
        (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`, [requestData.hangoutId, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]);
        const deletedAvailabilitySlots = secondResultSetHeader.affectedRows;
        const deletedSuggestions = thirdResultSetheader.affectedRows;
        await connection.commit();
        res.json({
            success: true,
            resData: {
                newAvailabilityStep,
                newSuggestionsStep,
                newVotingStep,
                newNextStepTimestamp,
                newConclusionTimestamp,
                deletedAvailabilitySlots,
                deletedSuggestions,
            },
        });
        const logDescription = `Hangout steps have been updated and will now be concluded on ${(0, globalUtils_1.getDateAndTimeSTring)(newConclusionTimestamp)} as a result. ${deletedAvailabilitySlots || 'No'} availability slots and ${deletedSuggestions || 'no'} suggestions were deleted with this change.`;
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutId, logDescription);
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
exports.hangoutsRouter.patch('/details/steps/progressForward', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
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
        hangouts.availability_step,
        hangouts.suggestions_step,
        hangouts.voting_step,
        hangouts.current_step,
        hangouts.current_step_timestamp,
        hangouts.created_on_timestamp,
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        (SELECT COUNT(*) FROM suggestions WHERE hangout_id = ?)
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ? AND
        hangout_members.hangout_member_id = ?
      LIMIT 1;`, [requestData.hangoutId, requestData.hangoutId, requestData.hangoutMemberId]);
        if (hangoutRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails[`${userType}_id`] !== userId) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (hangoutDetails.is_concluded) {
            res.status(409).json({ success: false, message: 'Hangout concluded.' });
            return;
        }
        ;
        if (hangoutDetails.current_step === 2 && hangoutDetails.suggestions_count === 0) {
            res.status(409).json({ success: false, message: 'Can not progress hangout without any suggestions.' });
            return;
        }
        ;
        const requestTimestamp = Date.now();
        const updatedCurrentStep = requestTimestamp - hangoutDetails.current_step_timestamp;
        const currentStepName = hangoutUtils.getCurrentStepName(hangoutDetails.current_step);
        hangoutDetails[`${currentStepName}_step`] = updatedCurrentStep;
        const newCurrentStep = hangoutDetails.current_step + 1;
        const newNextStepTimestamp = hangoutUtils.getNextStepTimestamp(newCurrentStep, requestTimestamp, hangoutDetails.availability_step, hangoutDetails.suggestions_step, hangoutDetails.voting_step);
        const { created_on_timestamp, availability_step, suggestions_step, voting_step } = hangoutDetails;
        const newConclusionTimestamp = created_on_timestamp + availability_step + suggestions_step + voting_step;
        if (hangoutDetails.current_step === 3) {
            const [firstResultSetHeader] = await db_1.dbPool.execute(`UPDATE
          hangouts
        SET
          availability_step = ?,
          suggestions_step = ?,
          voting_step = ?,
          current_step = ?,
          current_step_timestamp = ?,
          next_step_timestamp = ?,
          conclusion_timestamp = ?,
          is_concluded = ?
        WHERE
          hangout_id = ?;`, [availability_step, suggestions_step, voting_step, 4, requestTimestamp, newNextStepTimestamp, requestTimestamp, true, requestData.hangoutId]);
            if (firstResultSetHeader.affectedRows === 0) {
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
            const yearMilliseconds = 1000 * 60 * 60 * 24 * 365;
            const [secondResultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
          availability_slots
        WHERE
          hangout_id = ? AND
          (slot_start_timestamp < ? OR slot_start_timestamp > ?);`, [requestData.hangoutId, requestTimestamp, (requestTimestamp + yearMilliseconds)]);
            const [thirdResultSetheader] = await db_1.dbPool.execute(`DELETE FROM
          suggestions
        WHERE
          hangout_id = ? AND
          (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`, [requestData.hangoutId, requestTimestamp, (requestTimestamp + yearMilliseconds)]);
            const deletedAvailabilitySlots = secondResultSetHeader.affectedRows;
            const deletedSuggestions = thirdResultSetheader.affectedRows;
            res.json({
                success: true,
                resData: {
                    newCurrentStep: 4,
                    newNextStepTimestamp,
                    newConclusionTimestamp: requestTimestamp,
                    isConcluded: true,
                    deletedAvailabilitySlots,
                    deletedSuggestions,
                },
            });
            const logDescription = `Hangout has been manually progressed and is now concluded. ${deletedAvailabilitySlots || 'No'} availability slots and ${deletedSuggestions || 'no'} suggestions were deleted with this change.`;
            await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutId, logDescription);
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        hangouts
      SET
        availability_step = ?,
        suggestions_step = ?,
        voting_step = ?,
        current_step = ?,
        current_step_timestamp = ?,
        next_step_timestamp = ?,
        conclusion_timestamp = ?,
        is_concluded = ?
      WHERE
        hangout_id = ?;`, [availability_step, suggestions_step, voting_step, newCurrentStep, requestTimestamp, newNextStepTimestamp, newConclusionTimestamp, false, requestData.hangoutId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const yearMilliseconds = 1000 * 60 * 60 * 24 * 365;
        const [secondResultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        availability_slots
      WHERE
        hangout_id = ? AND
        (slot_start_timestamp < ? OR slot_start_timestamp > ?);`, [requestData.hangoutId, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]);
        const [thirdResultSetheader] = await db_1.dbPool.execute(`DELETE FROM
        suggestions
      WHERE
        hangout_id = ? AND
        (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`, [requestData.hangoutId, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]);
        const deletedAvailabilitySlots = secondResultSetHeader.affectedRows;
        const deletedSuggestions = thirdResultSetheader.affectedRows;
        res.json({
            success: true,
            resData: {
                newCurrentStep,
                newNextStepTimestamp,
                newConclusionTimestamp,
                isConcluded: false,
                deletedAvailabilitySlots,
                deletedSuggestions,
            },
        });
        const logDescription = `Hangout has been manually progressed, and will now be concluded on ${(0, globalUtils_1.getDateAndTimeSTring)(newConclusionTimestamp)} as a result. ${deletedAvailabilitySlots || 'No'} availability slots and ${deletedSuggestions || 'no'} suggestions were deleted with this change.`;
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutId, logDescription);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutsRouter.delete('/details/members/kick', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'memberToKickId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
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
        res.status(409).json({ success: false, message: 'Can not kick yourself.' });
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
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutId]);
        if (hangoutMemberRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.hangoutMemberId && member[`${userType}_id`] === userId);
        if (!hangoutMember) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
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
            const logDescription = `${memberToKick.display_name} was kicked.`;
            await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutId, logDescription);
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
        const logDescription = `${memberToKick.display_name} was kicked.`;
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutId, logDescription);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutsRouter.patch('/details/members/transferLeadership', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId', 'newLeaderMemberId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
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
        res.status(409).json({ success: false, message: 'Already hangout leader.' });
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
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutId]);
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.hangoutMemberId && member[`${userType}_id`] === userId);
        if (!hangoutMember) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
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
        is_leader = false
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
        const logDescription = `${hangoutMember.display_name} has appointed ${newHangoutLeader.display_name} new hangout leader.`;
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutId, logDescription);
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
exports.hangoutsRouter.patch('/details/members/claimLeadership', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
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
        const userType = (0, userUtils_1.getUserType)(authToken);
        const [userRows] = await db_1.dbPool.execute(`SELECT
        auth_token,
        display_name
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`, [userId]);
        if (userRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const userDetails = userRows[0];
        if (authToken !== userDetails.auth_token) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
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
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutId]);
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.hangoutMemberId && member[`${userType}_id`] === userId);
        if (!hangoutMember) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (hangoutMember.is_leader) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Already the hangout leader.' });
            return;
        }
        ;
        const hangoutContainsLeader = hangoutMemberRows.find((member) => member.is_leader) !== undefined;
        if (hangoutContainsLeader) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Hangout already has a leader.' });
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
        const logDescription = `${userDetails.display_name} has claimed the hangout leader role.`;
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutId, logDescription);
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
exports.hangoutsRouter.delete('/', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutMemberId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
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
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        account_id,
        guest_id,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        hangout_id = ?;`, [requestData.hangoutMemberId, requestData.hangoutId]);
        if (hangoutMemberRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows[0];
        if (hangoutMember[`${userType}_id`] !== userId) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (!hangoutMember.is_leader) {
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        hangouts
      WHERE
        hangout_id = ?;`, [requestData.hangoutId]);
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
exports.hangoutsRouter.get('/details/hangoutExists', async (req, res) => {
    const hangoutId = req.query.hangoutId;
    if (typeof hangoutId !== 'string' || !hangoutValidation.isValidHangoutId(hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
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
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isPasswordProtected = Boolean(hangoutRows[0].encrypted_password);
        res.json({
            success: true,
            resData: {
                isPasswordProtected,
            },
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutsRouter.post('/details/members/join/account', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.', reason: 'hangoutID' });
        return;
    }
    ;
    if (requestData.hangoutPassword && !(0, userValidation_1.isValidPassword)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password', reason: 'hangoutPassword' });
        return;
    }
    ;
    const userType = (0, userUtils_1.getUserType)(authToken);
    if (userType === 'guest') {
        res.status(403).json({ success: false, message: `Guest accounts can't join more than one hangout.`, reason: 'guestAccount' });
        return;
    }
    ;
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        connection.beginTransaction();
        ;
        const [userRows] = await connection.execute(`SELECT
        auth_token,
        display_name,
        (SELECT COUNT(*) FROM hangout_members WHERE account_id = :userId) AS joined_hangouts_count
      FROM
        accounts
      WHERE
        account_id = :userId;`, { userId });
        if (userRows.length === 0) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const userDetails = userRows[0];
        if (authToken !== userDetails.auth_token) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (userDetails.joined_hangouts_counts >= hangoutValidation.ongoingHangoutsLimit) {
            await connection.rollback();
            res.status(409).json({
                success: false,
                message: `You've reached the limit of ${hangoutValidation.ongoingHangoutsLimit} ongoing hangouts.`,
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
        hangout_id = :hangoutId;`, { hangoutId: requestData.hangoutId, userId });
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
        await connection.execute(`INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [requestData.hangoutId, userType, userId, null, userDetails.display_name, false]);
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
exports.hangoutsRouter.post('/details/members/join/guest', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'hangoutPassword', 'username', 'password', 'displayName'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.', reason: 'hangoutId' });
        return;
    }
    ;
    if (requestData.hangoutPassword && !(0, userValidation_1.isValidNewPassword)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.', reason: 'hangoutPassword' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidUsername)(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid username.', reason: 'username' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPassword)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid user password.', reason: 'userPassword' });
        return;
    }
    ;
    if (requestData.username === requestData.password) {
        res.status(400).json({ success: false, message: `Username and password can't be identical.`, reason: 'usernamePasswordIdentical' });
    }
    ;
    if (!(0, userValidation_1.isValidDisplayName)(requestData.displayName)) {
        res.status(400).json({ success: false, message: 'Invalid display name.', reason: 'displayName' });
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
            res.status(409).json({ success: false, message: 'Hangout full.', reason: 'hangoutFull' });
            return;
        }
        ;
        const [guestRows] = await connection.execute(`SELECT
        1
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
        const authToken = (0, tokenGenerator_1.generateAuthToken)('guest');
        const hashedPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const [resultSetHeader] = await connection.execute(`INSERT INTO guests(
        auth_token,
        username,
        hashed_password,
        display_name,
        hangout_id
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [authToken, requestData.username, hashedPassword, requestData.displayName, requestData.hangoutId]);
        const guestId = resultSetHeader.insertId;
        const idMarkedAuthToken = `${authToken}_${guestId}`;
        await connection.execute(`UPDATE
        guests
      SET
        auth_token = ?
      WHERE
        guest_id = ?;`, [idMarkedAuthToken, guestId]);
        await connection.execute(`INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [requestData.hangoutId, 'guest', null, guestId, requestData.displayName, false]);
        await connection.commit();
        res.json({ success: true, resData: { authToken: idMarkedAuthToken } });
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
exports.hangoutsRouter.get('/details/dashboard', async (req, res) => {
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
    const hangoutId = req.query.hangoutId;
    if (typeof hangoutId !== 'string') {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.', reason: 'hangoutId' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutId(hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.', reason: 'hangoutId' });
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
        hangouts.encrypted_password,
        hangouts.member_limit,
        hangout_members.hangout_member_id,
        hangout_members.${userType}_id as user_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?;`, [hangoutId]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutInfo = hangoutRows[0];
        const isPasswordProtected = Boolean(hangoutInfo.encrypted_password);
        const isFull = hangoutRows.length === hangoutInfo.member_limit;
        const requesterHangoutMember = hangoutRows.find((member) => member.user_id === userId);
        if (!requesterHangoutMember) {
            res.status(401).json({
                success: false,
                message: 'Not a member of this hangout.',
                reason: 'notMember',
                resData: {
                    isPasswordProtected,
                    isFull: isPasswordProtected ? null : isFull,
                },
            });
            return;
        }
        ;
        const [hangoutData] = await db_1.dbPool.query(`SELECT
        hangout_title,
        member_limit,
        availability_step,
        suggestions_step,
        voting_step,
        current_step,
        current_step_timestamp,
        next_step_timestamp,
        created_on_timestamp,
        conclusion_timestamp,
        is_concluded
      FROM
        hangouts
      WHERE
        hangout_id = :hangoutId;

      SELECT
        event_description,
        event_timestamp
      FROM
        hangout_events
      WHERE
        hangout_id = :hangoutId
      ORDER BY
        event_timestamp DESC
      LIMIT 2;

      SELECT
        hangout_member_id,
        user_type,
        display_name,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id = :hangoutId;

      SELECT
        COUNT(DISTINCT availability_slots.availability_slot_id) AS availability_slots_count,
        COUNT(DISTINCT suggestions.suggestion_id) AS suggestions_count,
        COUNT(DISTINCT votes.vote_id) AS votes_count
      FROM
        availability_slots
      LEFT JOIN
        suggestions ON availability_slots.hangout_member_id = suggestions.hangout_member_id
      LEFT JOIN
        votes ON suggestions.hangout_member_id = votes.hangout_member_id
      WHERE
        availability_slots.hangout_member_id = :hangoutMemberId
      LIMIT 1;

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
      LIMIT 2;`, { hangoutId, hangoutMemberId: requesterHangoutMember.hangout_member_id });
        if (hangoutData.length !== 5) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const hangoutDetails = hangoutData[0][0];
        const hangoutEvents = hangoutData[1];
        const hangoutMembers = hangoutData[2];
        const hangoutMemberCountables = hangoutData[3][0];
        const hangoutChats = hangoutData[4];
        let decryptedHangoutPassword = null;
        if (hangoutDetails.encrypted_password && requesterHangoutMember.is_leader) {
            decryptedHangoutPassword = (0, encryptionUtils_1.decryptPassword)(hangoutDetails.encrypted_password);
        }
        ;
        res.json({
            success: true,
            resData: {
                hangoutMemberId: requesterHangoutMember.hangout_member_id,
                isLeader: requesterHangoutMember.is_leader,
                isPasswordProtected,
                decryptedHangoutPassword,
                hangoutDetails,
                hangoutEvents,
                hangoutMembers,
                hangoutMemberCountables,
                hangoutChats,
            },
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
