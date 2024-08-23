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
const tokenGenerator_1 = require("../util/tokenGenerator");
const userUtils_1 = require("../util/userUtils");
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
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangouts.hashed_password,
        hangouts.member_limit,
        hangout_members.hangout_member_id
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation_1.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        const existingMembersCount = hangoutRows.length;
        if (existingMembersCount >= hangoutDetails.member_limit) {
            res.status(409).json({ success: false, message: 'Hangout full.' });
            return;
        }
        ;
        if (Boolean(hangoutDetails.hashed_password) !== Boolean(requestData.hangoutPassword)) {
            res.status(400).json({ success: false, message: 'Invalid request data.' });
            return;
        }
        ;
        if (hangoutDetails.hashed_password && requestData.hangoutPassword) {
            const isCorrectPassword = await bcrypt_1.default.compare(requestData.hangoutPassword, hangoutDetails.hashed_password);
            if (!isCorrectPassword) {
                res.status(401).json({ success: false, message: 'Incorrect hangout password.' });
                return;
            }
            ;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        const [usernameRows] = await connection.execute(`SELECT
        1
      FROM
        guests
      WHERE
        username = ?
      LIMIT 1;`, [requestData.username]);
        if (usernameRows.length > 0) {
            await connection.rollback();
            res.status(409).json({ success: false, message: 'Username taken.' });
            return;
        }
        ;
        const authToken = (0, tokenGenerator_1.generateAuthToken)('guest');
        const guestHashedPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const [firstResultSetHeader] = await connection.execute(`INSERT INTO guests(
        auth_token,
        username,
        hashed_password,
        display_name,
        hangout_id
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [authToken, requestData.username, guestHashedPassword, requestData.displayName, requestData.hangoutID]);
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
        await connection.execute(`INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [requestData.hangoutID, 'guest', null, guestID, false]);
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
exports.hangoutMembersRouter.post('/create/accountMember', async (req, res) => {
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
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        auth_token
      FROM
        accounts
      WHERE
        account_id = ?;`, [accountID]);
        if (accountRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (authToken !== accountRows[0].auth_token) {
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
        hangouts.completed_on_timestamp IS NULL AND
        hangout_members.account_id = ?
      LIMIT ${hangoutValidation_1.ongoingHangoutsLimit};`, [accountID]);
        if (ongoingHangoutsRows.length >= hangoutValidation_1.ongoingHangoutsLimit) {
            res.status(403).json({ success: false, message: 'Ongoing hangouts limit reached.' });
            return;
        }
        ;
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangouts.hashed_password,
        hangouts.member_limit,
        hangout_members.account_id
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = ?
      LIMIT ${hangoutValidation_1.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isMember = hangoutRows.find((member) => member.account_id === accountID) !== undefined;
        if (isMember) {
            res.status(409).json({ success: false, message: 'Already a member of this hangout.' });
            return;
        }
        ;
        const hangoutDetails = hangoutRows[0];
        if (Boolean(hangoutDetails.hashed_password) !== Boolean(requestData.hangoutPassword)) {
            res.status(400).json({ success: false, message: 'Invalid request data.' });
            return;
        }
        ;
        if (hangoutDetails.hashed_password && requestData.hangoutPassword) {
            const isCorrectPassword = await bcrypt_1.default.compare(requestData.hangoutPassword, hangoutDetails.hashed_password);
            if (!isCorrectPassword) {
                res.status(401).json({ success: false, message: 'Incorrect password.' });
                return;
            }
            ;
        }
        ;
        const existingMembersCount = hangoutRows.length;
        if (existingMembersCount >= hangoutDetails.member_limit) {
            res.status(409).json({ success: false, message: 'Hangout full.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [requestData.hangoutID, 'account', accountID, null, false]);
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
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
    if (!(0, hangoutValidation_1.isValidHangoutIDString)(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    let connection;
    try {
        const userType = authToken.startsWith('a') ? 'account' : 'guest';
        ;
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
        const userAuthToken = userRows[0].auth_token;
        if (authToken !== userAuthToken) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        ;
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        hangout_member_id,
        account_id,
        guest_id,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id = ?
      LIMIT ${hangoutValidation_1.hangoutMemberLimit};`, [requestData.hangoutID]);
        if (hangoutMemberRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const userMember = hangoutMemberRows.find((member) => member[`${userType}_id`] === userID);
        if (!userMember) {
            res.status(403).json({ success: false, message: 'Not a member in this hangout.' });
            return;
        }
        ;
        if (!userMember.is_leader) {
            if (userMember.guest_id) {
                const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
            guests
          WHERE
            guest_id = ?;`, [userMember.guest_id]);
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
          hangout_member_id = ?;`, [userMember.hangout_member_id]);
            if (resultSetHeader.affectedRows === 0) {
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
            res.json({ success: true, resData: {} });
            return;
        }
        ;
        if (hangoutMemberRows.length < 2) {
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
            return;
        }
        ;
        const randomNewLeader = hangoutMemberRows.find((member) => member.hangout_member_id);
        if (!randomNewLeader) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const [firstResultSetHeader] = await connection.execute(`UPDATE
        hangout_members
      SET
        is_leader = TRUE
      WHERE
        hangout_member_id = ?;`, [randomNewLeader.hangout_member_id]);
        if (firstResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const [secondResultSetHeader] = await connection.execute(`DELETE FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`, [userMember.hangout_member_id]);
        if (secondResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
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
