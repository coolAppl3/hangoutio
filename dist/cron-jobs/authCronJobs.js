"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearExpiredAuthSessions = void 0;
const db_1 = require("../db/db");
async function clearExpiredAuthSessions() {
    try {
        const currentTimestamp = Date.now();
        await db_1.dbPool.execute(`DELETE FROM
        auth_sessions
      WHERE
        expiry_timestamp <= ?;`, [currentTimestamp]);
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${clearExpiredAuthSessions.name}`);
        console.log(err);
    }
    ;
}
exports.clearExpiredAuthSessions = clearExpiredAuthSessions;
;
