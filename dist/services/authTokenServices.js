"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateHangoutMemberAuthToken = exports.validateAuthToken = void 0;
const db_1 = require("../db/db");
async function validateAuthToken(res, authToken) {
    let tableName = '';
    if (authToken.startsWith('a')) {
        tableName = 'Accounts';
    }
    ;
    if (authToken.startsWith('g')) {
        tableName = 'Guests';
    }
    ;
    if (tableName === '') {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return false;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT auth_token FROM ${tableName}
      WHERE auth_token = ?
      LIMIT 1;`, [authToken]);
        if (rows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return false;
        }
        ;
        return true;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return false;
    }
    ;
}
exports.validateAuthToken = validateAuthToken;
;
async function validateHangoutMemberAuthToken(res, authToken, hangoutMemberID) {
    if (!Number.isInteger(hangoutMemberID)) {
        return false;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT auth_token FROM HangoutMembers
      WHERE hangout_member_id = ?;`, [hangoutMemberID]);
        if (rows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return false;
        }
        ;
        return true;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return false;
    }
    ;
}
exports.validateHangoutMemberAuthToken = validateHangoutMemberAuthToken;
;
