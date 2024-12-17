"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNoMemberHangouts = exports.concludeNoSuggestionHangouts = exports.progressHangouts = void 0;
const db_1 = require("../db/db");
const constants_1 = require("../util/constants");
async function progressHangouts() {
    const currentTimestamp = Date.now();
    try {
        await db_1.dbPool.execute(`UPDATE
        hangouts
      SET
        is_concluded = CASE
          WHEN current_stage = ${constants_1.HANGOUT_VOTING_STAGE} THEN TRUE
          ELSE is_concluded
        END,
        current_stage = current_stage + 1,
        stage_control_timestamp = ?
      WHERE
        stage_control_timestamp >= availability_period AND current_stage = ${constants_1.HANGOUT_AVAILABILITY_STAGE}
        OR
        stage_control_timestamp >= suggestions_period AND current_stage = ${constants_1.HANGOUT_SUGGESTIONS_STAGE}
        OR
        stage_control_timestamp >= voting_period AND current_stage = ${constants_1.HANGOUT_VOTING_STAGE}`, [currentTimestamp]);
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
    const currentTimestamp = Date.now();
    try {
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangouts.hangout_id
      FROM
        hangouts
      LEFT JOIN
        suggestions ON hangouts.hangout_id = suggestions.hangout_id
      WHERE
        hangouts.current_stage = ${constants_1.HANGOUT_VOTING_STAGE} AND
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
        current_stage = ${constants_1.HANGOUT_CONCLUSION_STAGE},
        stage_control_timestamp = ?,
        is_concluded = ?
      WHERE
        hangout_id IN (${hangoutIdsString});`, [currentTimestamp, true]);
        if (resultSetHeader.affectedRows !== hangoutRows.length) {
            console.log(`CRON JOB ERROR: ${concludeNoSuggestionHangouts.name}`);
            console.log({
                timestamp: currentTimestamp,
                expectedAffectedRows: hangoutIds.length,
                affectedRows: resultSetHeader.affectedRows,
                hangoutIds,
                resultSetHeader,
            });
        }
        ;
        const eventDescription = 'Hangout reached the voting stage without any suggestions, and has therefore been automatically concluded.';
        let hangoutValuesString = '';
        for (const id of hangoutIds) {
            hangoutValuesString += `('${id}', '${eventDescription}', ${currentTimestamp}),`;
        }
        ;
        hangoutValuesString = hangoutValuesString.slice(0, -1);
        await db_1.dbPool.execute(`INSERT INTO hangout_events (
        hangout_id,
        event_description,
        event_timestamp
      ) VALUES ${hangoutValuesString};`);
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${concludeNoSuggestionHangouts.name}`);
        console.log(err);
    }
    ;
}
exports.concludeNoSuggestionHangouts = concludeNoSuggestionHangouts;
;
async function deleteNoMemberHangouts() {
    await db_1.dbPool.execute(`DELETE FROM
    hangouts
      WHERE
    NOT EXISTS (
      SELECT
        1 AS members_exist
      FROM
        hangout_members
      WHERE
        hangout_members.hangout_id = hangouts.hangout_id
    );`);
}
exports.deleteNoMemberHangouts = deleteNoMemberHangouts;
;
