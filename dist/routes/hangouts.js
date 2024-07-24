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
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
const hangoutValidation = __importStar(require("../util/validation/hangoutValidation"));
const requestValidation_1 = require("../util/validation/requestValidation");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const userValidation_1 = require("../util/validation/userValidation");
const routersServices_1 = require("../services/routersServices");
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
    const requestData = req.body;
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const expectedKeys = ['hangoutPassword', 'memberLimit', 'availabilityPeriod', 'suggestionsPeriod', 'votingPeriod'];
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
    const { availabilityPeriod, suggestionsPeriod, votingPeriod } = requestData;
    if (!hangoutValidation.isValidHangoutConfiguration(availabilityPeriod, suggestionsPeriod, votingPeriod)) {
        res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
        return;
    }
    ;
    let connection;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        is_verified
      FROM
        Accounts
      WHERE
        auth_token = ?
      LIMIT 1;`, [authToken]);
        if (rows.length === 0) {
            res.status(401).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const isVerified = rows[0].is_verified;
        if (!isVerified) {
            res.status(403).json({ success: false, message: 'Account not validated.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const hangoutID = await (0, routersServices_1.createHangout)(connection, res, requestData);
        if (!hangoutID) {
            return;
        }
        ;
        await connection.execute(`INSERT INTO HangoutMembers(
        hangout_id,
        auth_token,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [hangoutID, authToken, true]);
        await connection.commit();
        res.json({ success: true, resData: { hangoutID } });
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
exports.hangoutsRouter.post('/create/guestLeader', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutPassword', 'memberLimit', 'availabilityPeriod', 'suggestionsPeriod', 'votingPeriod', 'userName', 'password'];
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
    const { availabilityPeriod, suggestionsPeriod, votingPeriod } = requestData;
    if (!hangoutValidation.isValidHangoutConfiguration(availabilityPeriod, suggestionsPeriod, votingPeriod)) {
        res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNameString)(requestData.userName)) {
        res.status(400).json({ success: false, message: 'Invalid guest name.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPasswordString)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid guest password.' });
        return;
    }
    ;
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const hangoutID = await (0, routersServices_1.createHangout)(connection, res, requestData);
        if (!hangoutID) {
            return;
        }
        ;
        ;
        const hashedPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const newGuestData = {
            userName: requestData.userName,
            hashedPassword,
            hangoutID,
        };
        const authToken = await (0, routersServices_1.createGuestAccount)(connection, res, newGuestData);
        if (!authToken) {
            return;
        }
        ;
        await connection.execute(`INSERT INTO HangoutMembers(
        hangout_id,
        auth_token,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [hangoutID, authToken, true]);
        await connection.commit();
        res.json({ success: true, resData: { hangoutID, authToken } });
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
exports.hangoutsRouter.put('/details/updatePassword', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    const requestData = req.body;
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const expectedKeys = ['hangoutID', 'currentPassword', 'newPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (requestData.currentPassword !== null && !(0, userValidation_1.isValidPasswordString)(requestData.currentPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPasswordString)(requestData.newPassword)) {
        res.status(400).json({ success: false, message: 'Invalid new hangout password.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        Hangouts.hashed_password,
        HangoutMembers.auth_token
      FROM
        Hangouts
      LEFT JOIN
        HangoutMembers ON Hangouts.hangout_id = HangoutMembers.hangout_id
      WHERE
        Hangouts.hangout_id = ? AND
        HangoutMembers.is_leader = TRUE
      LIMIT 1;`, [requestData.hangoutID]);
        if (rows.length === 0) {
            res.status(404).json({ succesS: false, message: 'Hangout not found.' });
            return;
        }
        ;
        ;
        const hangoutDetails = {
            leaderAuthToken: rows[0].auth_token,
            hashedPassword: rows[0].hashed_password,
        };
        if (authToken !== hangoutDetails.leaderAuthToken) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (requestData.currentPassword && hangoutDetails.hashedPassword) {
            const isCorrectPassword = await bcrypt_1.default.compare(requestData.currentPassword, hangoutDetails.hashedPassword);
            if (!isCorrectPassword) {
                res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
                return;
            }
            ;
        }
        ;
        const newHashedPassword = await bcrypt_1.default.hash(requestData.newPassword, 10);
        await db_1.dbPool.execute(`UPDATE
        Hangouts
      SET
        hashed_password = ?
      WHERE
        hangout_id = ?;`, [newHashedPassword, requestData.hangoutID]);
        res.json({ success: true, message: 'Password successfully updated.' });
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
    const requestData = req.body;
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const expectedKeys = ['hangoutID', 'newLimit'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutIDString(requestData.hangoutID)) {
        res.status(404).json({ success: 'false', message: 'Hangout not found.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutMemberLimit(requestData.newLimit)) {
        res.status(409).json({ success: false, message: 'Invalid new member limit.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        Hangouts.member_limit,
        HangoutMembers.auth_token,
        HangoutMembers.is_leader
      FROM
        Hangouts
      LEFT JOIN
        HangoutMembers ON Hangouts.hangout_id = HangoutMembers.hangout_id
      WHERE
        Hangouts.hangout_id = ?;`, [requestData.hangoutID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isHangoutLeader = rows.find((member) => member.auth_token === authToken && member.is_leader);
        if (!isHangoutLeader) {
            res.status(401).json({ success: false, message: 'Not hangout leader. Request denied.' });
            return;
        }
        ;
        const currentMemberLimit = rows[0].member_limit;
        if (currentMemberLimit === requestData.newLimit) {
            res.status(409).json({ success: false, message: `Member limit is already set to ${requestData.newLimit}.` });
            return;
        }
        ;
        const numberOfCurrentMembers = rows.length;
        if (requestData.newLimit < numberOfCurrentMembers) {
            res.status(409).json({ success: false, message: 'New member limit is less than the number of existing members.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`UPDATE
        Hangouts
      SET
        member_limit = ?
      WHERE
        hangout_id = ?;`, [requestData.newLimit, requestData.hangoutID]);
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutsRouter.put('/details/steps/changePeriods', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    const requestData = req.body;
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const expectedKeys = ['hangoutID', 'newAvailabilityPeriod', 'newSuggestionsPeriod', 'newVotingPeriod'];
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
    const { newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod } = requestData;
    if (!hangoutValidation.isValidHangoutConfiguration(newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod)) {
        res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        Hangouts.current_step,
        Hangouts.step_timestamp,
        Hangouts.availability_period,
        Hangouts.suggestions_period,
        Hangouts.voting_period,
        HangoutMembers.auth_token
      FROM
        Hangouts
      LEFT JOIN
        HangoutMembers ON Hangouts.hangout_id = HangoutMembers.hangout_id
      WHERE
        Hangouts.hangout_id = ? AND
        HangoutMembers.is_leader = TRUE
      LIMIT 1;`, [requestData.hangoutID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const leaderAuthToken = rows[0].auth_token;
        if (authToken !== leaderAuthToken) {
            res.status(401).json({ success: false, message: 'Not hangout leader. Request denied.' });
            return;
        }
        ;
        ;
        ;
        const hangoutDetails = {
            currentStep: rows[0].current_step,
            stepTimestamp: rows[0].step_timestamp,
            currentAvailabilityPeriod: rows[0].availability_period,
            currentSuggestionsPeriod: rows[0].suggestions_period,
            currentVotingPeriod: rows[0].voting_period,
        };
        const newPeriods = {
            newAvailabilityPeriod: requestData.newAvailabilityPeriod,
            newSuggestionsPeriod: requestData.newSuggestionsPeriod,
            newVotingPeriod: requestData.newVotingPeriod,
        };
        if (!hangoutValidation.isValidNewPeriods(hangoutDetails, newPeriods)) {
            res.status(409).json({ success: false, message: 'Invalid new configuration.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`UPDATE
        Hangouts
      SET
        availability_period = ?,
        suggestions_period = ?,
        voting_period = ?
      WHERE
        hangout_id = ?
      LIMIT 1;`, [newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod, requestData.hangoutID]);
        res.json({ success: true, resData: { newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutsRouter.put('/details/steps/progress', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    const requestData = req.body;
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const expectedKeys = ['hangoutID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!hangoutValidation.isValidHangoutIDString) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        Hangouts.current_step,
        HangoutMembers.auth_token
      FROM
        Hangouts
      LEFT JOIN
        HangoutMembers ON Hangouts.hangout_id = HangoutMembers.hangout_id
      WHERE
        Hangouts.hangout_id = ? AND
        HangoutMembers.is_leader = TRUE
      LIMIT 1;`, [requestData.hangoutID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const leaderAuthToken = rows[0].auth_token;
        if (authToken !== leaderAuthToken) {
            res.status(401).json({ success: false, message: 'Not hangout leader. Request denied.' });
            return;
        }
        ;
        const currentHangoutStep = rows[0].current_step;
        if (currentHangoutStep === 4) {
            res.status(400).json({ success: false, message: 'Hangout is completed.' });
            return;
        }
        ;
        if (currentHangoutStep < 3) {
            await db_1.dbPool.execute(`UPDATE
          Hangouts
        SET
          current_step = current_step + 1
        WHERE
          hangout_id = ?;`, [requestData.hangoutID]);
            res.json({ success: true, resData: { newStep: currentHangoutStep + 1, completed: false } });
            return;
        }
        ;
        await db_1.dbPool.execute(`UPDATE
        Hangouts
      SET
        current_step = ?,
        completed_on_timestamp = ?
      WHERE
        hangout_id = ?;`, [4, Date.now(), requestData.hangoutID]);
        res.json({ success: true, resData: { newStep: 4, completed: true } });
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
    const requestData = req.body;
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
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
        const [rows] = await db_1.dbPool.execute(`SELECT
        hangout_member_id,
        auth_token,
        is_leader
      FROM
        HangoutMembers
      WHERE
        hangout_id = ?;`, [requestData.hangoutID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isHangoutLeader = rows.find((member) => member.auth_token === authToken && member.is_leader);
        if (!isHangoutLeader) {
            res.status(401).json({ success: false, message: 'Not hangout leader. Request denied.' });
            return;
        }
        ;
        const memberToKick = rows.find((member) => member.hangout_member_id === requestData.hangoutMemberID);
        if (!memberToKick) {
            res.status(404).json({ success: false, message: 'Member not found.' });
            return;
        }
        ;
        if (memberToKick.auth_token === authToken) {
            res.status(409).json({ success: false, message: 'Can not kick yourself.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`DELETE FROM
        HangoutMembers
      WHERE
        hangout_member_id = ?;`, [requestData.hangoutMemberID]);
        if (memberToKick.auth_token.startsWith('g')) {
            await db_1.dbPool.execute(`DELETE FROM
          Guests
        WHERE
          auth_token = ?;`, [memberToKick.auth_token]);
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
exports.hangoutsRouter.put('/details/members/transferLeadership', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    const requestData = req.body;
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const expectedKeys = ['hangoutID', 'hangoutPassword', 'newLeaderMemberID'];
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
    if (!(0, userValidation_1.isValidPasswordString)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.' });
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
        const [rows] = await db_1.dbPool.execute(`SELECT
        Hangouts.hashed_password,
        HangoutMembers.hangout_member_id,
        HangoutMembers.auth_token,
        HangoutMembers.is_leader
      FROM
        Hangouts
      LEFT JOIN
        HangoutMembers ON Hangouts.hangout_id = HangoutMembers.hangout_id
      WHERE
        Hangouts.hangout_id = ?;`, [requestData.hangoutID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutHashedPassword = rows[0].hashed_password;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.hangoutPassword, hangoutHashedPassword);
        if (!isCorrectPassword) {
            res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
            return;
        }
        ;
        const isHangoutLeader = rows.find((member) => member.auth_token === authToken && member.is_leader);
        if (!isHangoutLeader) {
            res.status(401).json({ success: false, message: 'Not hangout leader. Request denied.' });
            return;
        }
        ;
        if (isHangoutLeader.hangout_member_id === requestData.newLeaderMemberID) {
            res.status(409).json({ success: false, message: 'You are already the hangout leader.' });
            return;
        }
        ;
        const newHangoutLeader = rows.find((member) => member.hangout_member_id === requestData.newLeaderMemberID);
        if (!newHangoutLeader) {
            res.status(404).json({ success: false, message: 'Member not found.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        await connection.execute(`UPDATE
        HangoutMembers
      SET
        is_leader = ?
      WHERE
        hangout_id = ? AND
        auth_token = ?
      LIMIT 1;`, [false, requestData.hangoutID, authToken]);
        await connection.execute(`UPDATE
        HangoutMembers
      SET
        is_leader = TRUE
      WHERE
        hangout_id = ? AND
        hangout_member_id = ?
      LIMIT 1;`, [requestData.hangoutID, newHangoutLeader.hangout_member_id]);
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
exports.hangoutsRouter.delete('/', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    const requestData = req.body;
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const expectedKeys = ['hangoutID', 'hangoutPassword'];
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
    if (!(0, userValidation_1.isValidPasswordString)(requestData.hangoutPassword)) {
        res.status(400).json({ succesS: false, message: 'Invalid hangout password.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        Hangouts.hashed_password,
        HangoutMembers.auth_token
      FROM
        Hangouts
      LEFT JOIN
        HangoutMembers ON Hangouts.hangout_id = HangoutMembers.hangout_id
      WHERE
        Hangouts.hangout_id = ? AND
        HangoutMembers.is_leader = TRUE
      LIMIT 1;`, [requestData.hangoutID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutHashedPassword = rows[0].hashed_password;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.hangoutPassword, hangoutHashedPassword);
        if (!isCorrectPassword) {
            res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
            return;
        }
        ;
        const leaderAuthToken = rows[0].auth_token;
        if (authToken !== leaderAuthToken) {
            res.status(401).json({ success: false, message: 'Not hangout leader. Request Denied.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`DELETE FROM
        Hangouts
      WHERE
        hangout_id = ?;`, [requestData.hangoutID]);
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
