"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearErrorLogs = void 0;
const db_1 = require("../db/db");
const constants_1 = require("../util/constants");
async function clearErrorLogs() {
    const currentTimestamp = Date.now();
    try {
        await db_1.dbPool.execute(`DELETE FROM
        unexpected_errors
      WHERE
        ? - error_timestamp >= ?;`, [currentTimestamp, 2 * constants_1.dayMilliseconds]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.clearErrorLogs = clearErrorLogs;
;
