"use strict";
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
const routersServices_1 = require("../services/routersServices");
exports.hangoutMembersRouter = express_1.default.Router();
exports.hangoutMembersRouter.post('/create/guestMember', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutID', 'hangoutPassword', 'username', 'password', 'displayName'];
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
    if (requestData.hangoutPassword !== null && !(0, userValidation_1.isValidPasswordString)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidUsernameString)(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid username.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPasswordString)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
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
        const [rows] = await db_1.dbPool.execute(`SELECT
        Hangouts.hashed_password,
        Hangouts.member_limit,
        HangoutMembers.hangout_member_id
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
        ;
        const hangoutDetails = {
            hangoutPassword: rows[0].hashed_password,
            memberLimit: rows[0].member_limit,
        };
        const existingMembersCount = rows.length;
        if (existingMembersCount === hangoutDetails.memberLimit) {
            res.status(409).json({ success: false, message: 'Hangout full.' });
            return;
        }
        ;
        if (Boolean(hangoutDetails.hangoutPassword) !== Boolean(requestData.hangoutPassword)) {
            res.status(400).json({ success: false, message: 'Invalid request data.' });
            return;
        }
        ;
        if (hangoutDetails.hangoutPassword && requestData.hangoutPassword) {
            const isCorrectPassword = await bcrypt_1.default.compare(requestData.hangoutPassword, hangoutDetails.hangoutPassword);
            if (!isCorrectPassword) {
                res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
                return;
            }
            ;
        }
        ;
        const hashedPassword = await bcrypt_1.default.hash(requestData.password, 10);
        ;
        const newGuestData = {
            username: requestData.username,
            hashedPassword,
            displayName: requestData.displayName,
            hangoutID: requestData.hangoutID,
        };
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const guestAuthToken = await (0, routersServices_1.createGuestAccount)(connection, res, newGuestData);
        if (!guestAuthToken) {
            return;
        }
        ;
        connection.execute(`INSERT INTO HangoutMembers(
        hangout_id,
        auth_token,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [requestData.hangoutID, guestAuthToken, false]);
        connection.commit();
        res.json({ success: true, resData: { guestAuthToken } });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (err.errno === 1452) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
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
exports.hangoutMembersRouter.post('/create/accountMember', async (req, res) => {
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
    if (!(0, hangoutValidation_1.isValidHangoutIDString)(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (requestData.hangoutPassword !== null && !(0, userValidation_1.isValidPasswordString)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.' });
        return;
    }
    ;
    try {
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        is_verified
      FROM
        Accounts
      WHERE
        auth_token = ?;`, [authToken]);
        if (accountRows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const isVerified = accountRows[0].is_verified;
        if (!isVerified) {
            res.status(403).json({ success: false, message: 'Account not verified.' });
            return;
        }
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        Hangouts.hashed_password,
        Hangouts.member_limit,
        HangoutMembers.auth_token
      FROM
        Hangouts
      LEFT JOIN
        HangoutMembers ON Hangouts.hangout_id = HangoutMembers.hangout_id
      WHERE
        Hangouts.hangout_id = ?;`, [requestData.hangoutID]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        for (const member of hangoutRows) {
            if (member.auth_token === authToken) {
                res.status(409).json({ success: false, message: 'Already a member of this hangout.' });
                return;
            }
            ;
        }
        ;
        ;
        const hangoutDetails = {
            hashedPassword: hangoutRows[0].hashed_password,
            memberLimit: hangoutRows[0].member_limit,
        };
        if (Boolean(hangoutDetails.hashedPassword) !== Boolean(requestData.hangoutPassword)) {
            res.status(400).json({ success: false, message: 'Invalid request data.' });
            return;
        }
        ;
        if (hangoutDetails.hashedPassword && requestData.hangoutPassword) {
            const isCorrectPassword = await bcrypt_1.default.compare(requestData.hangoutPassword, hangoutDetails.hashedPassword);
            if (!isCorrectPassword) {
                res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
                return;
            }
            ;
        }
        ;
        const existingMembersCount = hangoutRows.length;
        if (existingMembersCount === hangoutDetails.memberLimit) {
            res.status(409).json({ success: false, message: 'Hangout full.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`INSERT INTO HangoutMembers(
        hangout_id,
        auth_token,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [requestData.hangoutID, authToken, false]);
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1452) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutMembersRouter.put('/details/leaveHangout', async (req, res) => {
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
    if (!(0, hangoutValidation_1.isValidHangoutIDString)(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    let connection;
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
        const member = rows.find((member) => member.auth_token === authToken);
        if (!member) {
            res.status(404).json({ success: false, messagE: 'You are not a member of this hangout.' });
            return;
        }
        ;
        if (member.is_leader) {
            const randomNewLeader = rows.find((member) => !member.is_leader);
            if (!randomNewLeader) {
                await db_1.dbPool.execute(`DELETE FROM
            Hangouts
          WHERE
            hangout_id = ?`, [requestData.hangoutID]);
                res.json({ success: true, resData: {} });
                return;
            }
            ;
            connection = await db_1.dbPool.getConnection();
            await connection.beginTransaction();
            await connection.execute(`UPDATE
          HangoutMembers
        SET
          is_leader = TRUE
        WHERE
          hangout_member_id = ?;`, [randomNewLeader.hangout_member_id]);
            await connection.execute(`UPDATE
          HangoutMembers
        SET
          is_leader = FALSE
        WHERE
          hangout_member_id = ?;`, [member.hangout_member_id]);
            await connection.commit();
        }
        ;
        await db_1.dbPool.execute(`DELETE FROM
        HangoutMembers
      WHERE
        hangout_member_id = ?;`, [member.hangout_member_id]);
        if (authToken.startsWith('g')) {
            await db_1.dbPool.execute(`DELETE FROM
          Guests
        WHERE
          auth_token = ?
        LIMIT 1;`, [authToken]);
        }
        ;
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
