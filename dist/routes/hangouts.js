"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hangoutsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
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
    if (!(0, hangoutValidation_1.isValidHangoutMemberLimit)(requestData.memberLimit)) {
        res.status(400).json({ success: false, message: 'Invalid member limit.' });
        return;
    }
    ;
    const { availabilityPeriod, suggestionsPeriod, votingPeriod } = requestData;
    if (!(0, hangoutValidation_1.isValidHangoutConfiguration)(availabilityPeriod, suggestionsPeriod, votingPeriod)) {
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
    if (!(0, hangoutValidation_1.isValidHangoutMemberLimit)(requestData.memberLimit)) {
        res.status(400).json({ success: false, message: 'Invalid member limit.' });
        return;
    }
    ;
    const { availabilityPeriod, suggestionsPeriod, votingPeriod } = requestData;
    if (!(0, hangoutValidation_1.isValidHangoutConfiguration)(availabilityPeriod, suggestionsPeriod, votingPeriod)) {
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
        await db_1.dbPool.execute(`UPDATE Hangouts
        SET hashed_password = ?
      WHERE hangout_id = ?`, [newHashedPassword, requestData.hangoutID]);
        res.json({ success: true, message: 'Password successfully updated.' });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
