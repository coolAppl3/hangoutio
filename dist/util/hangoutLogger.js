"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addHangoutLog = void 0;
const db_1 = require("../db/db");
const generatePlaceHolders_1 = require("./generatePlaceHolders");
async function addHangoutLog(hangoutId, logDescription) {
    try {
        await db_1.dbPool.execute(`INSERT INTO hangout_logs(
        hangout_id,
        log_description,
        log_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [hangoutId, logDescription, Date.now()]);
    }
    catch (err) {
        console.log(`HANGOUT LOGGING ERROR: ${err}`);
    }
    ;
}
exports.addHangoutLog = addHangoutLog;
;
