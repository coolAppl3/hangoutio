"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHangoutCapacity = exports.getHangoutMemberLimit = exports.hangoutLeaderExists = exports.validateHangoutID = void 0;
const db_1 = require("../db/db");
async function validateHangoutID(res, hangoutID) {
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT hangout_id FROM Hangouts
      WHERE hangout_id = ?`, [hangoutID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
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
exports.validateHangoutID = validateHangoutID;
;
async function hangoutLeaderExists(res, hangoutID) {
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT hangout_member_id FROM HangoutMembers
      WHERE hangout_id = ? AND is_leader = TRUE`, [hangoutID]);
        if (rows.length > 0) {
            res.status(409).json({ success: false, message: 'Hangout already has a leader.' });
            return true;
        }
        ;
        return false;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return true;
    }
    ;
}
exports.hangoutLeaderExists = hangoutLeaderExists;
;
async function getHangoutMemberLimit(res, hangoutID) {
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT member_limit FROM Hangouts
      WHERE hangout_id = ?;`, [hangoutID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return 0;
        }
        ;
        const hangoutMemberLimit = rows[0].member_limit;
        return hangoutMemberLimit;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return 0;
    }
    ;
}
exports.getHangoutMemberLimit = getHangoutMemberLimit;
;
async function getHangoutCapacity(res, hangoutID, hangoutMemberLimit) {
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT hangout_member_id FROM HangoutMembers
      WHERE hangout_id = ?;`, [hangoutID]);
        if (rows.length >= hangoutMemberLimit) {
            res.status(403).json({ success: false, message: 'Hangout is full.' });
            return true;
        }
        ;
        return false;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return true;
    }
    ;
}
exports.getHangoutCapacity = getHangoutCapacity;
;
