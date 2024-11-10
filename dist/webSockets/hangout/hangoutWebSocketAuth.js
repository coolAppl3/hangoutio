"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateHandshake = void 0;
const userValidation_1 = require("../../util/validation/userValidation");
const hangoutValidation_1 = require("../../util/validation/hangoutValidation");
const db_1 = require("../../db/db");
const userUtils_1 = require("../../util/userUtils");
async function authenticateHandshake(req) {
    const authToken = req.headersDistinct['sec-websocket-protocol']?.[0];
    if (!authToken) {
        return null;
    }
    ;
    if (!(0, userValidation_1.isValidAuthToken)(authToken)) {
        return null;
    }
    ;
    if (!req.url) {
        return null;
    }
    ;
    const url = new URL(req.url, `https://${req.headers.host}`);
    const hangoutMemberId = url.searchParams.get('hangoutMemberId');
    const hangoutId = url.searchParams.get('hangoutId');
    if (!hangoutMemberId || !hangoutId) {
        return null;
    }
    ;
    if (!Number.isInteger(+hangoutMemberId) || !(0, hangoutValidation_1.isValidHangoutID)(hangoutId)) {
        return null;
    }
    ;
    if (!(await isValidUserData(authToken, +hangoutMemberId, hangoutId))) {
        return null;
    }
    ;
    return { hangoutId, hangoutMemberId: +hangoutMemberId };
}
exports.authenticateHandshake = authenticateHandshake;
;
async function isValidUserData(authToken, hangoutMemberId, hangoutId) {
    try {
        const userID = (0, userUtils_1.getUserID)(authToken);
        const userType = (0, userUtils_1.getUserType)(authToken);
        ;
        const [userRows] = await db_1.dbPool.execute(`SELECT
        auth_token
      FROM
        ${userType}s
      WHERE
        ${userType}_id = ?;`, [userID]);
        if (userRows.length === 0) {
            return false;
        }
        ;
        if (authToken !== userRows[0].auth_token) {
            return false;
        }
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        1
      FROM
        hangout_members
      WHERE
        hangout_member_id = ? AND
        ${userType}_id = ? AND
        hangout_id = ?;`, [hangoutMemberId, userID, hangoutId]);
        if (hangoutRows.length === 0) {
            return false;
        }
        ;
        return true;
    }
    catch (err) {
        console.log(err);
        return false;
    }
    ;
}
;
