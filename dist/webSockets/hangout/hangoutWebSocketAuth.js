"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateHandshake = void 0;
const db_1 = require("../../db/db");
const authUtils_1 = require("../../auth/authUtils");
const authSessions_1 = require("../../auth/authSessions");
const hangoutValidation_1 = require("../../util/validation/hangoutValidation");
async function authenticateHandshake(req) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
        return null;
    }
    ;
    const cookieHeaderArr = cookieHeader.split('; ');
    let authSessionId = null;
    for (const cookie of cookieHeaderArr) {
        const [cookieName, cookieValue] = cookie.split('=');
        if (cookieName === 'authSessionId' && (0, authUtils_1.isValidAuthSessionId)(cookieValue)) {
            authSessionId = cookieValue;
            break;
        }
        ;
    }
    ;
    if (!authSessionId) {
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
    if (!hangoutMemberId || !Number.isInteger(+hangoutMemberId)) {
        return null;
    }
    ;
    if (!hangoutId || !(0, hangoutValidation_1.isValidHangoutId)(hangoutId)) {
        return null;
    }
    ;
    if (!(await isValidUserData(authSessionId, +hangoutMemberId, hangoutId))) {
        return null;
    }
    ;
    return { hangoutMemberId: +hangoutMemberId, hangoutId };
}
exports.authenticateHandshake = authenticateHandshake;
;
async function isValidUserData(authSessionId, hangoutMemberId, hangoutId) {
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        if (authSessionRows.length === 0) {
            return false;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!(0, authUtils_1.isValidAuthSessionDetails)(authSessionDetails)) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            return false;
        }
        ;
        ;
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        hangout_id,
        account_id,
        guest_id
      FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`, [hangoutMemberId]);
        if (hangoutMemberRows.length === 0) {
            return false;
        }
        ;
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            return false;
        }
        ;
        if (hangoutMemberDetails.hangout_id !== hangoutId) {
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
