"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNoMemberHangouts = exports.concludeNoSuggestionHangouts = exports.concludeSingleSuggestionHangouts = exports.progressHangouts = void 0;
const db_1 = require("../db/db");
const constants_1 = require("../util/constants");
const hangoutWebSocketServer_1 = require("../webSockets/hangout/hangoutWebSocketServer");
async function progressHangouts() {
    const currentTimestamp = Date.now();
    try {
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangout_id,
        current_stage
      FROM
        hangouts
      WHERE
        (:currentTimestamp - stage_control_timestamp) >= availability_period AND current_stage = ${constants_1.HANGOUT_AVAILABILITY_STAGE}
        OR
        (:currentTimestamp - stage_control_timestamp) >= suggestions_period AND current_stage = ${constants_1.HANGOUT_SUGGESTIONS_STAGE}
        OR
        (:currentTimestamp - stage_control_timestamp) >= voting_period AND current_stage = ${constants_1.HANGOUT_VOTING_STAGE};`, { currentTimestamp });
        if (hangoutRows.length === 0) {
            return;
        }
        ;
        const hangoutIdsToProgress = hangoutRows.map((hangout) => hangout.hangout_id);
        await db_1.dbPool.query(`UPDATE
        hangouts
      SET
        is_concluded = CASE
          WHEN current_stage = ${constants_1.HANGOUT_VOTING_STAGE} THEN TRUE
          ELSE FALSE
        END,
        current_stage = current_stage + 1,
        stage_control_timestamp = ?
      WHERE
        hangout_id IN (?);`, [currentTimestamp, hangoutIdsToProgress]);
        const eventDescription = 'Hangout was concluded.';
        let hangoutEventRowValuesString = '';
        for (const hangout of hangoutRows) {
            if (hangout.current_stage < constants_1.HANGOUT_VOTING_STAGE) {
                continue;
            }
            ;
            hangoutEventRowValuesString += `('${hangout.hangout_id}', '${eventDescription}', ${currentTimestamp}),`;
        }
        ;
        if (hangoutEventRowValuesString.length > 0) {
            hangoutEventRowValuesString = hangoutEventRowValuesString.slice(0, -1);
            await db_1.dbPool.execute(`INSERT INTO hangout_events (
        hangout_id,
        event_description,
        event_timestamp
      ) VALUES ${hangoutEventRowValuesString};`);
        }
        ;
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)(hangoutIdsToProgress, {
            type: 'hangout',
            reason: 'hangoutAutoProgressed',
            data: {
                newStageControlTimestamp: currentTimestamp,
                eventTimestamp: currentTimestamp,
                eventDescription,
            },
        });
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${progressHangouts.name}`);
        console.log(err);
    }
    ;
}
exports.progressHangouts = progressHangouts;
;
async function concludeSingleSuggestionHangouts() {
    const currentTimestamp = Date.now();
    try {
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangout_id
      FROM
        hangouts
      WHERE
        current_stage = ${constants_1.HANGOUT_VOTING_STAGE} AND
        (SELECT COUNT(*) FROM suggestions WHERE suggestions.hangout_id = hangouts.hangout_id) = 1;`);
        if (hangoutRows.length === 0) {
            return;
        }
        ;
        const hangoutIdsToProgress = hangoutRows.map((hangout) => hangout.hangout_id);
        await db_1.dbPool.query(`UPDATE
        hangouts
      SET
        voting_period = (? - stage_control_timestamp),
        current_stage = ?,
        stage_control_timestamp = ?,
        is_concluded = ?
      WHERE
        hangout_id IN (?);`, [currentTimestamp, constants_1.HANGOUT_CONCLUSION_STAGE, currentTimestamp, true, hangoutIdsToProgress]);
        const eventDescription = 'The hangout reached the voting stage with a single suggestion, marking it as the winning suggestion without any votes.';
        let hangoutEventRowValuesString = '';
        for (const id of hangoutIdsToProgress) {
            hangoutEventRowValuesString += `('${id}', '${eventDescription}', ${currentTimestamp}),`;
        }
        ;
        hangoutEventRowValuesString = hangoutEventRowValuesString.slice(0, -1);
        await db_1.dbPool.execute(`INSERT INTO hangout_events (
        hangout_id,
        event_description,
        event_timestamp
      ) VALUES ${hangoutEventRowValuesString};`);
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)(hangoutIdsToProgress, {
            type: 'hangout',
            reason: 'singleSuggestionConclusion',
            data: {
                newStageControlTimestamp: currentTimestamp,
                eventTimestamp: currentTimestamp,
                eventDescription,
            },
        });
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${concludeNoSuggestionHangouts.name}`);
        console.log(err);
    }
    ;
}
exports.concludeSingleSuggestionHangouts = concludeSingleSuggestionHangouts;
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
        const hangoutIdsToProgress = hangoutRows.map((hangout) => hangout.hangout_id);
        await db_1.dbPool.query(`UPDATE
        hangouts
      SET
        voting_period = (? - stage_control_timestamp),
        current_stage = ?,
        stage_control_timestamp = ?,
        is_concluded = ?
      WHERE
        hangout_id IN (?);`, [currentTimestamp, constants_1.HANGOUT_CONCLUSION_STAGE, currentTimestamp, true, hangoutIdsToProgress]);
        const eventDescription = 'Hangout reached the voting stage without any suggestions, leading to a failed conclusion.';
        let hangoutEventRowValuesString = '';
        for (const id of hangoutIdsToProgress) {
            hangoutEventRowValuesString += `('${id}', '${eventDescription}', ${currentTimestamp}),`;
        }
        ;
        hangoutEventRowValuesString = hangoutEventRowValuesString.slice(0, -1);
        await db_1.dbPool.execute(`INSERT INTO hangout_events (
        hangout_id,
        event_description,
        event_timestamp
      ) VALUES ${hangoutEventRowValuesString};`);
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)(hangoutIdsToProgress, {
            type: 'hangout',
            reason: 'noSuggestionConclusion',
            data: {
                newStageControlTimestamp: currentTimestamp,
                eventTimestamp: currentTimestamp,
                eventDescription,
            },
        });
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
