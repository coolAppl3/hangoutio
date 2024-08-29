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
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const accountID = (0, userUtils_1.getUserID)(authToken);
    const requestData = req.body;
    const expectedKeys = ['hangoutPassword', 'memberLimit', 'availabilityStep', 'suggestionsStep', 'votingStep'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (requestData.hangoutPassword !== null && !(0, userValidation_1.isValidNewPasswordString)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutMemberLimit(requestData.memberLimit)) {
        res.status(400).json({ success: false, message: 'Invalid member limit.' });
        return;
    }
    ;
    const { availabilityStep, suggestionsStep, votingStep } = requestData;
    if (!hangoutValidation.isValidHangoutSteps(1, [availabilityStep, suggestionsStep, votingStep])) {
        res.status(400).json({ success: false, message: 'Invalid hangout steps.' });
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
        account_id = ?;`, [accountID]);
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
        hangouts.is_concluded = FALSE AND
        hangout_members.account_id = ?
      LIMIT ${hangoutValidation.ongoingHangoutsLimit};`, [accountID]);
        if (ongoingHangoutsRows.length >= hangoutValidation.ongoingHangoutsLimit) {
            res.status(403).json({ success: false, message: 'Ongoing hangouts limit reached.' });
            return;
        }
        ;
        const createdOnTimestamp = Date.now();
        const hangoutID = (0, tokenGenerator_1.generateHangoutID)(createdOnTimestamp);
        const hashedPassword = requestData.hangoutPassword ? await bcrypt_1.default.hash(requestData.hangoutPassword, 10) : null;
        const nextStepTimestamp = createdOnTimestamp + availabilityStep;
        const conclusionTimestamp = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        await connection.execute(`INSERT INTO hangouts(
        hangout_id,
        hashed_password,
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
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(12)});`, [hangoutID, hashedPassword, requestData.memberLimit, availabilityStep, suggestionsStep, votingStep, 1, createdOnTimestamp, nextStepTimestamp, createdOnTimestamp, conclusionTimestamp, false]);
        const [resultSetHeader] = await connection.execute(`INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [hangoutID, 'account', accountID, null, accountDetails.display_name, true]);
        await connection.commit();
        res.json({ success: true, resData: { hangoutID, hangoutMemberID: resultSetHeader.insertId } });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (err.errno === 1062) {
            res.status(409).json({ success: false, message: 'Duplicate hangout ID.' });
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
    const expectedKeys = ['hangoutPassword', 'memberLimit', 'availabilityStep', 'suggestionsStep', 'votingStep', 'username', 'password', 'displayName'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (requestData.hangoutPassword !== null && !(0, userValidation_1.isValidNewPasswordString)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutMemberLimit(requestData.memberLimit)) {
        res.status(400).json({ success: false, message: 'Invalid member limit.' });
        return;
    }
    ;
    const { availabilityStep, suggestionsStep, votingStep } = requestData;
    if (!hangoutValidation.isValidHangoutSteps(1, [availabilityStep, suggestionsStep, votingStep])) {
        res.status(400).json({ success: false, message: 'Invalid hangout steps.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidUsernameString)(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid username.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPasswordString)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid guest password.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidDisplayNameString)(requestData.displayName)) {
        res.status(400).json({ success: false, message: 'Invalid display name.' });
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
            res.status(409).json({ success: false, message: 'Username taken.' });
            return;
        }
        ;
        const createdOnTimestamp = Date.now();
        const hangoutID = (0, tokenGenerator_1.generateHangoutID)(createdOnTimestamp);
        const hashedHangoutPassword = requestData.hangoutPassword ? await bcrypt_1.default.hash(requestData.hangoutPassword, 10) : null;
        const nextStepTimestamp = createdOnTimestamp + availabilityStep;
        const conclusionTimestamp = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;
        await connection.execute(`INSERT INTO hangouts(
        hangout_id,
        hashed_password,
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
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(12)});`, [hangoutID, hashedHangoutPassword, requestData.memberLimit, availabilityStep, suggestionsStep, votingStep, 1, createdOnTimestamp, nextStepTimestamp, createdOnTimestamp, conclusionTimestamp, false]);
        const authToken = (0, tokenGenerator_1.generateAuthToken)('guest');
        const hashedGuestPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const [firstResultSetHeader] = await connection.execute(`INSERT INTO guests(
        auth_token,
        username,
        hashed_password,
        display_name,
        hangout_id
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [authToken, requestData.username, hashedGuestPassword, requestData.displayName, hangoutID]);
        const guestID = firstResultSetHeader.insertId;
        const idMarkedAuthToken = `${authToken}_${guestID}`;
        const [secondResultSetHeader] = await connection.execute(`UPDATE
        guests
      SET
        auth_token = ?
      WHERE
        guest_id = ?;`, [idMarkedAuthToken, guestID]);
        if (secondResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const [thirdResultSetheader] = await connection.execute(`INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [hangoutID, 'guest', null, guestID, requestData.displayName, true]);
        await connection.commit();
        res.json({ success: true, resData: { hangoutID, hangoutMemberID: thirdResultSetheader.insertId, authToken: idMarkedAuthToken } });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (err.errno === 1062) {
            res.status(409).json({ success: false, message: 'Duplicate hangout ID.' });
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
exports.hangoutsRouter.put('/details/updatePassword', async (req, res) => {
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
    const expectedKeys = ['hangoutID', 'newPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPasswordString)(requestData.newPassword)) {
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
        hangouts.hashed_password,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isHangoutLeader = hangoutRows.find((member) => member[`${userType}_id`] === userID && member.is_leader) !== undefined;
        if (!isHangoutLeader) {
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails.hashed_password) {
            const isIdenticalPassword = await bcrypt_1.default.compare(requestData.newPassword, hangoutDetails.hashed_password);
            if (isIdenticalPassword) {
                res.status(409).json({ success: false, message: 'Identical password.' });
                return;
            }
            ;
        }
        ;
        const newHashedPassword = await bcrypt_1.default.hash(requestData.newPassword, 10);
        const [firstResultSetHeader] = await db_1.dbPool.execute(`UPDATE
        hangouts
      SET
        hashed_password = ?
      WHERE
        hangout_id = ?;`, [newHashedPassword, requestData.hangoutID]);
        if (firstResultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: {} });
        const logDescription = 'Hangout password was updated.';
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutID, logDescription);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutsRouter.put('/details/changeMemberLimit', async (req, res) => {
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
    const expectedKeys = ['hangoutID', 'newLimit'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
        res.status(404).json({ success: 'false', message: 'Invalid hangout ID.' });
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
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        const [hangoutMemberRows] = await connection.execute(`SELECT
        hangouts.member_limit,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isHangoutLeader = hangoutMemberRows.find((member) => member[`${userType}_id`] === userID && member.is_leader) !== undefined;
        if (!isHangoutLeader) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        if (hangoutMemberRows[0].member_limit === requestData.newLimit) {
            await connection.rollback();
            res.status(409).json({ success: false, message: `Member limit is already set to ${requestData.newLimit}.` });
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
        hangout_id = ?;`, [requestData.newLimit, requestData.hangoutID]);
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        res.json({ success: true, resData: {} });
        const logDescription = `Hangout member limit was changed to ${requestData.newLimit}.`;
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutID, logDescription);
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
exports.hangoutsRouter.put('/details/steps/update', async (req, res) => {
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
    const expectedKeys = ['hangoutID', 'newAvailabilityStep', 'newSuggestionsStep', 'newVotingStep'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
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
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isHangoutLeader = hangoutRows.find((member) => member[`${userType}_id`] === userID && member.is_leader) !== undefined;
        if (!isHangoutLeader) {
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails.is_concluded) {
            res.status(409).json({ success: false, message: 'Hangout already concluded.' });
            return;
        }
        ;
        const { newAvailabilityStep, newSuggestionsStep, newVotingStep } = requestData;
        if (!hangoutValidation.isValidHangoutSteps(hangoutDetails.current_step, [newAvailabilityStep, newSuggestionsStep, newVotingStep])) {
            res.status(400).json({ success: false, message: 'Invalid mew hangout steps.' });
            return;
        }
        ;
        const newSteps = {
            newAvailabilityStep,
            newSuggestionsStep,
            newVotingStep,
        };
        if (!hangoutValidation.isValidNewHangoutSteps(hangoutDetails, newSteps)) {
            res.status(400).json({ success: false, message: 'Invalid new hangout steps.' });
            return;
        }
        ;
        const newConclusionTimestamp = hangoutDetails.created_on_timestamp + newAvailabilityStep + newSuggestionsStep + newVotingStep;
        const newNextStepTimestamp = hangoutUtils.getNextStepTimestamp(hangoutDetails.current_step, hangoutDetails.current_step_timestamp, hangoutDetails.availability_step, hangoutDetails.suggestions_step, hangoutDetails.voting_step);
        const [firstResultSetHeader] = await db_1.dbPool.execute(`UPDATE
        hangouts
      SET
        availability_step = ?,
        suggestions_step = ?,
        voting_step = ?,
        next_step_timestamp = ?,
        conclusion_timestamp = ?
      WHERE
        hangout_id = ?;`, [newAvailabilityStep, newSuggestionsStep, newVotingStep, newNextStepTimestamp, newConclusionTimestamp, requestData.hangoutID]);
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
        (slot_start_timestamp < ? OR slot_start_timestamp > ?);`, [requestData.hangoutID, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]);
        const [thirdResultSetheader] = await db_1.dbPool.execute(`DELETE FROM
        suggestions
      WHERE
        hangout_id = ? AND
        (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`, [requestData.hangoutID, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]);
        const deletedAvailabilitySlots = secondResultSetHeader.affectedRows;
        const deletedSuggestions = thirdResultSetheader.affectedRows;
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
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutID, logDescription);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutsRouter.put('/details/steps/progressForward', async (req, res) => {
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
    const expectedKeys = ['hangoutID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
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
        hangouts.availability_step,
        hangouts.suggestions_step,
        hangouts.voting_step,
        hangouts.current_step,
        hangouts.current_step_timestamp,
        hangouts.created_on_timestamp,
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isHangoutLeader = hangoutRows.find((member) => member[`${userType}_id`] === userID && member.is_leader) !== undefined;
        if (!isHangoutLeader) {
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (hangoutDetails.is_concluded) {
            res.status(409).json({ success: false, message: 'Hangout already concluded.' });
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
          hangout_id = ?;`, [availability_step, suggestions_step, voting_step, 4, requestTimestamp, newNextStepTimestamp, requestTimestamp, true, requestData.hangoutID]);
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
          (slot_start_timestamp < ? OR slot_start_timestamp > ?);`, [requestData.hangoutID, requestTimestamp, (requestTimestamp + yearMilliseconds)]);
            const [thirdResultSetheader] = await db_1.dbPool.execute(`DELETE FROM
          suggestions
        WHERE
          hangout_id = ? AND
          (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`, [requestData.hangoutID, requestTimestamp, (requestTimestamp + yearMilliseconds)]);
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
            await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutID, logDescription);
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
        hangout_id = ?;`, [availability_step, suggestions_step, voting_step, newCurrentStep, requestTimestamp, newNextStepTimestamp, newConclusionTimestamp, false, requestData.hangoutID]);
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
        (slot_start_timestamp < ? OR slot_start_timestamp > ?);`, [requestData.hangoutID, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]);
        const [thirdResultSetheader] = await db_1.dbPool.execute(`DELETE FROM
        suggestions
      WHERE
        hangout_id = ? AND
        (suggestion_start_timestamp < ? OR suggestion_start_timestamp > ?);`, [requestData.hangoutID, newConclusionTimestamp, (newConclusionTimestamp + yearMilliseconds)]);
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
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutID, logDescription);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutsRouter.put('/details/members/kick', async (req, res) => {
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
    const expectedKeys = ['hangoutID', 'hangoutMemberID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberID)) {
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
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutMemberRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutLeader = hangoutMemberRows.find((member) => member[`${userType}_id`] === userID && member.is_leader);
        if (!hangoutLeader) {
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        if (hangoutLeader.hangout_member_id === requestData.hangoutMemberID) {
            res.status(403).json({ success: false, message: 'Can not kick yourself.' });
            return;
        }
        ;
        const memberToKick = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.hangoutMemberID);
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
        const logDescription = `${memberToKick.display_name} was kicked by hangout leader.`;
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutID, logDescription);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutsRouter.put('/details/members/transferLeadership', async (req, res) => {
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
    const expectedKeys = ['hangoutID', 'newLeaderMemberID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.newLeaderMemberID)) {
        res.status(400).json({ success: false, message: 'Invalid new leader hangout member ID.' });
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
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutLeader = hangoutMemberRows.find((member) => member[`${userType}_id`] === userID && member.is_leader);
        if (!hangoutLeader) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Not hangout leader.' });
            return;
        }
        ;
        if (hangoutLeader.hangout_member_id === requestData.newLeaderMemberID) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Already hangout leader.' });
            return;
        }
        ;
        const newHangoutLeader = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.newLeaderMemberID);
        if (!newHangoutLeader) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Member not found.' });
            return;
        }
        ;
        const [firstResultSetHeader] = await connection.execute(`UPDATE
        hangout_members
      SET
        is_leader = FALSE
      WHERE
        hangout_member_id = ?;`, [hangoutLeader.hangout_member_id]);
        if (firstResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const [secondResultSetHeader] = await connection.execute(`UPDATE
        hangout_members
      SET
        is_leader = TRUE
      WHERE
        hangout_member_id = ?;`, [newHangoutLeader.hangout_member_id]);
        if (secondResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        res.json({ success: true, resData: {} });
        const logDescription = `${hangoutLeader.display_name} has appointed ${newHangoutLeader.display_name} new hangout leader.`;
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutID, logDescription);
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
exports.hangoutsRouter.put('/details/members/claimLeadership', async (req, res) => {
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
    const expectedKeys = ['hangoutID', 'hangoutMemberID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
        res.status(404).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member ID.' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const userType = req.body;
        const [userRows] = await db_1.dbPool.execute(`SELECT
        auth_token,
        display_name
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`, [userID]);
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
      LIMIT ${hangoutValidation.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows.find((member) => member.hangout_member_id === requestData.hangoutMemberID && member[`${userType}_id`] === userID);
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
        hangout_member_id = ?;`, [true, requestData.hangoutMemberID]);
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        res.json({ success: true, resData: {} });
        const logDescription = `${userDetails.display_name} has claimed the hangout leader role.`;
        await (0, hangoutLogger_1.addHangoutLog)(requestData.hangoutID, logDescription);
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
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const userID = (0, userUtils_1.getUserID)(authToken);
    const requestData = req.body;
    const expectedKeys = ['hangoutID', 'hangoutMemberID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberID)) {
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
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        account_id,
        guest_id,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        hangout_id = ?;`, [requestData.hangoutMemberID, requestData.hangoutID]);
        if (hangoutMemberRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows[0];
        if (hangoutMember[`${userType}_id`] !== userID) {
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
        hangout_id = ?;`, [requestData.hangoutID]);
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
