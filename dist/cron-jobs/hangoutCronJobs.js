"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.concludeNoSuggestionHangouts = exports.progressHangouts = void 0;
const db_1 = require("../db/db");
async function progressHangouts() {
    const currentTimestamp = Date.now();
    const weekMilliseconds = 1000 * 60 * 60 * 24 * 7;
    try {
        await db_1.dbPool.execute(`UPDATE
        hangouts
      SET
        next_step_timestamp = CASE
          WHEN current_step = 1 THEN suggestions_step + ${currentTimestamp}
          WHEN current_step = 2 THEN voting_step + ${currentTimestamp}
          ELSE current_step = ${currentTimestamp + weekMilliseconds}
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
        console.log(`CRON JOB ERROR: ${progressHangouts.name}`);
        console.log(err);
    }
    ;
}
exports.progressHangouts = progressHangouts;
;
async function concludeNoSuggestionHangouts() {
    try {
        const currentTimestamp = Date.now();
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangouts.hangout_id
      FROM
        hangouts
      LEFT JOIN
        suggestions ON hangouts.hangout_id = suggestions.hangout_id
      WHERE
        hangouts.current_step = 3 AND
        suggestions.suggestion_id IS NULL;`);
        if (hangoutRows.length === 0) {
            return;
        }
        ;
        const hangoutIds = hangoutRows.map((hangout) => hangout.hangout_id);
        const hangoutIdsString = `'${hangoutIds.join(`', '`)}'`;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        hangouts
      SET
        current_step = ?,
        current_step_timestamp = ?,
        next_step_timestamp = ?,
        conclusion_timestamp = ?,
        is_concluded = ?
      WHERE
        hangout_id IN (${hangoutIdsString});`, [4, currentTimestamp, null, currentTimestamp, true]);
        if (resultSetHeader.affectedRows !== hangoutRows.length) {
            console.log(`CRON JOB ERROR: ${concludeNoSuggestionHangouts.name}`);
            console.log({
                resultSetHeader,
                hangoutIds,
            });
        }
        ;
        const logDescription = 'Hangout could not progress into the voting step due to not having any suggestion, and is now concluded as a result.';
        let hangoutValuesString = '';
        for (const id of hangoutIds) {
            hangoutValuesString += `('${id}', '${logDescription}', ${currentTimestamp}),`;
        }
        ;
        hangoutValuesString = hangoutValuesString.slice(0, -1);
        await db_1.dbPool.execute(`INSERT INTO hangout_logs(
        hangout_id,
        log_description,
        log_timestamp
      )
      VALUES ${hangoutValuesString};`);
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${concludeNoSuggestionHangouts.name}`);
        console.log(err);
    }
    ;
}
exports.concludeNoSuggestionHangouts = concludeNoSuggestionHangouts;
;
