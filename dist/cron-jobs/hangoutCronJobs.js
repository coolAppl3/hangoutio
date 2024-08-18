"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressHangouts = void 0;
const db_1 = require("../db/db");
async function progressHangouts() {
    const currentTimestamp = Date.now();
    try {
        await db_1.dbPool.query(`UPDATE
        hangouts
      SET
        next_step_timestamp = CASE
          WHEN current_step = 1 THEN suggestions_step + ${currentTimestamp}
          WHEN current_step = 2 THEN voting_step + ${currentTimestamp}
          ELSE NULL
        END,
        is_concluded = CASE
          WHEN current_step = 3 THEN TRUE
          ELSE is_concluded
        END,
        current_step = CASE
          WHEN current_step < 4 THEN current_step + 1
          ELSE current_step
        END,
        current_step_timestamp = ${currentTimestamp}
      WHERE
        is_concluded = FALSE AND
        next_step_timestamp <= ${currentTimestamp};`);
    }
    catch (err) {
        console.log(`CRON JOB ERROR (${progressHangouts.name}): ${err}`);
    }
    ;
}
exports.progressHangouts = progressHangouts;
;
