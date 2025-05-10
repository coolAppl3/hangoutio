"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = void 0;
const cookieUtils_1 = require("../util/cookieUtils");
const db_1 = require("../db/db");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const tokenGenerator_1 = require("../util/tokenGenerator");
const constants_1 = require("../util/constants");
async function rateLimiter(req, res, next) {
    const rateLimitId = (0, cookieUtils_1.getRequestCookie)(req, 'rateLimitId');
    const isChatRequest = checkForChatRequest(req);
    if (!rateLimitId) {
        await addToRateTracker(res, isChatRequest);
        next();
        return;
    }
    ;
    if (!isValidRateLimitId(rateLimitId)) {
        await addToRateTracker(res, true);
        next();
        return;
    }
    ;
    if (await rateLimitReached(rateLimitId, isChatRequest, res)) {
        res.status(429).json({ message: 'Too many requests.' });
        incrementRequestsCount(rateLimitId, isChatRequest);
        return;
    }
    ;
    incrementRequestsCount(rateLimitId, isChatRequest);
    next();
}
exports.rateLimiter = rateLimiter;
;
async function addToRateTracker(res, isChatRequest) {
    const newRateId = (0, tokenGenerator_1.generateRateLimitId)();
    const currentTimestamp = Date.now();
    try {
        await db_1.dbPool.execute(`INSERT INTO rate_tracker (
        rate_limit_id,
        general_requests_count,
        chat_requests_count,
        window_timestamp
      ) VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)});`, [newRateId, isChatRequest ? 0 : 1, isChatRequest ? 1 : 0, currentTimestamp]);
        (0, cookieUtils_1.setResponseCookie)(res, 'rateLimitId', newRateId, constants_1.hourMilliseconds, true);
    }
    catch (err) {
        console.log('RATE LIMITING ERROR:', err);
    }
    ;
}
;
async function rateLimitReached(rateLimitId, isChatRequest, res) {
    const columnToCheck = isChatRequest ? 'chat_requests_count' : 'general_requests_count';
    ;
    try {
        const [rateTrackerRows] = await db_1.dbPool.execute(`SELECT
        ${columnToCheck} AS requests_count
      FROM
        rate_tracker
      WHERE
        rate_limit_id = ?;`, [rateLimitId]);
        const rateTrackerDetails = rateTrackerRows[0];
        if (!rateTrackerDetails) {
            await addToRateTracker(res, isChatRequest);
            return false;
        }
        ;
        if (rateTrackerDetails.requests_count > (isChatRequest ? constants_1.CHAT_REQUESTS_RATE_LIMIT : constants_1.GENERAL_REQUESTS_RATE_LIMIT)) {
            return true;
        }
        ;
        return false;
    }
    catch (err) {
        console.log(err);
        return false;
    }
    ;
}
;
async function incrementRequestsCount(rateLimitId, isChatRequest) {
    const columnToUpdate = isChatRequest ? 'chat_requests_count' : 'general_requests_count';
    try {
        await db_1.dbPool.execute(`UPDATE
        rate_tracker
      SET
        ${columnToUpdate} = ${columnToUpdate} + 1
      WHERE
        rate_limit_id = ?;`, [rateLimitId]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
;
function isValidRateLimitId(rateLimitId) {
    if (!rateLimitId.startsWith('r')) {
        return false;
    }
    ;
    if (rateLimitId.length !== 32) {
        return false;
    }
    ;
    const regex = /^[A-Za-z0-9]{32}$/;
    return regex.test(rateLimitId);
}
;
function checkForChatRequest(req) {
    if (req.path === '/chat' && req.method === 'POST') {
        return true;
    }
    ;
    return false;
}
;
