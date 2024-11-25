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
const addHangoutEvent_1 = require("../util/addHangoutEvent");
const voteValidation_1 = require("../util/validation/voteValidation");
exports.hangoutMembersRouter = express_1.default.Router();
exports.hangoutMembersRouter.post('/create/accountMember', async (req, res) => {
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
    const expectedKeys = ['hangoutId', 'hangoutPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (requestData.hangoutPassword !== null && !(0, userValidation_1.isValidPassword)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.' });
        return;
    }
    ;
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
      LIMIT ${hangoutValidation_1.ongoingHangoutsLimit};`, [false, accountId]);
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
      LIMIT ${hangoutValidation_1.hangoutMemberLimit};`, [requestData.hangoutId]);
        if (hangoutRows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        const isMember = hangoutRows.find((member) => member.account_id === accountId) !== undefined;
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
        const [resultSetHeader] = await db_1.dbPool.execute(`INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [requestData.hangoutId, 'account', accountId, null, accountDetails.display_name, false]);
        res.json({ success: true, resData: { hangoutMemberId: resultSetHeader.insertId } });
        const logDescription = `${accountDetails.display_name} has joined the hangout.`;
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, logDescription);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.hangoutMembersRouter.post('/create/guestMember', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'hangoutPassword', 'username', 'password', 'displayName'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (requestData.hangoutPassword !== null && !(0, userValidation_1.isValidPassword)(requestData.hangoutPassword)) {
        res.status(400).json({ success: false, message: 'Invalid hangout password.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidUsername)(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid username.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidNewPassword)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidDisplayName)(requestData.displayName)) {
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
      LIMIT ${hangoutValidation_1.hangoutMemberLimit};`, [requestData.hangoutId]);
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
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [authToken, requestData.username, guestHashedPassword, requestData.displayName, requestData.hangoutId]);
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
        const [thirdResultSetheader] = await connection.execute(`INSERT INTO hangout_members(
        hangout_id,
        user_type,
        account_id,
        guest_id,
        display_name,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [requestData.hangoutId, 'guest', null, guestId, requestData.displayName, false]);
        await connection.commit();
        res.status(201).json({ success: true, resData: { authToken: idMarkedAuthToken, hangoutMemberId: thirdResultSetheader.insertId } });
        const logDescription = `${requestData.displayName} has joined the hangout.`;
        (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, logDescription);
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
exports.hangoutMembersRouter.delete(`/`, async (req, res) => {
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
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberId)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
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
        hangouts.is_concluded,
        hangout_members.account_id,
        hangout_members.guest_id,
        hangout_members.is_leader,
        (SELECT COUNT(*) FROM votes WHERE hangout_member_id = :hangoutMemberId) as requester_votes_count,
        (SELECT COUNT(*) FROM hangout_members WHERE hangout_id = :hangoutId) as hangout_members_count
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.hangout_id = :hangoutId AND
        hangout_members.hangout_member_id = :hangoutMemberId
      LIMIT 1;`, { hangoutId: requestData.hangoutId, hangoutMemberId: requestData.hangoutMemberId });
        if (hangoutMemberRows.length === 0) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const hangoutMember = hangoutMemberRows[0];
        if (hangoutMember[`${userType}_id`] !== userId) {
            await connection.rollback();
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (hangoutMember.hangout_members_count === 1) {
            const [resultSetHeader] = await connection.execute(`DELETE FROM
          hangouts
        WHERE
          hangout_id = ?;`, [requestData.hangoutId]);
            if (resultSetHeader.affectedRows === 0) {
                await connection.rollback();
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
            await connection.commit();
            res.json({ success: true, resData: { hangoutDeleted: true, guestUserDeleted: false } });
        }
        ;
        if (hangoutMember.requester_votes_count > 0 && !hangoutMember.is_concluded) {
            const [resultSetHeader] = await connection.execute(`DELETE FROM
          votes
        WHERE
          hangout_member_id = ?
        LIMIT ${voteValidation_1.votesLimit};`, [requestData.hangoutMemberId]);
            if (resultSetHeader.affectedRows === 0) {
                await connection.rollback();
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
        }
        ;
        if (hangoutMember.guest_id) {
            const [resultSetHeader] = await connection.execute(`DELETE FROM
          guests
        WHERE
          guest_id = ?;`, [userId]);
            if (resultSetHeader.affectedRows === 0) {
                await connection.rollback();
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
            await connection.commit();
            res.json({ success: true, resData: { hangoutDeleted: false, guestUserDeleted: true } });
            const logDescription = `${userDetails.display_name} has left the hangout.${hangoutMember.is_leader ? ' Hangout leader role is available to be claimed.' : ''}`;
            await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, logDescription);
            return;
        }
        ;
        const [resultSetHeader] = await connection.execute(`DELETE FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`, [requestData.hangoutMemberId]);
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        res.json({ success: true, resData: { hangoutDeleted: false, guestUserDeleted: false } });
        const logDescription = `${userRows[0].display_name} has left the hangout.${hangoutMember.is_leader ? ' Hangout leader role is available to be claimed.' : ''}`;
        await (0, addHangoutEvent_1.addHangoutEvent)(requestData.hangoutId, logDescription);
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
