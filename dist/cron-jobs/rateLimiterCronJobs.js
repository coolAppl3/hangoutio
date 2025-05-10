"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeStaleRateTrackerRows = exports.replenishRateRequests = void 0;
const db_1 = require("../db/db");
const constants_1 = require("../util/constants");
async function replenishRateRequests() {
    const currentTimestamp = Date.now();
    const generalRequestsToReplenish = constants_1.GENERAL_REQUESTS_RATE_LIMIT / 2;
    const chatRequestsToReplenish = constants_1.CHAT_REQUESTS_RATE_LIMIT / 2;
    try {
        await db_1.dbPool.execute(`UPDATE
        rate_tracker
      SET
        general_requests_count = general_requests_count - ?,
        chat_requests_count = chat_requests_count - ?
      WHERE
        ? - window_timestamp >= ?;`, [generalRequestsToReplenish, chatRequestsToReplenish, currentTimestamp, constants_1.minuteMilliseconds / 2]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.replenishRateRequests = replenishRateRequests;
;
async function removeStaleRateTrackerRows() {
    console.log(true);
    const currentTimestamp = Date.now();
    try {
        await db_1.dbPool.execute(`DELETE FROM
        rate_tracker
      WHERE
        ? - window_timestamp >= ? AND
        general_requests_count = 0 AND
        chat_requests_count = 0;`, [currentTimestamp, constants_1.minuteMilliseconds]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.removeStaleRateTrackerRows = removeStaleRateTrackerRows;
;
