"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNoMemberHangouts = exports.concludeNoSuggestionHangouts = exports.progressHangouts = void 0;
const db_1 = require("../db/db");
const constants_1 = require("../util/constants");
const hangoutWebSocketServer_1 = require("../webSockets/hangout/hangoutWebSocketServer");
async function progressHangouts() {
    const currentTimestamp = Date.now();
    try {
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangout_id
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
          ELSE is_concluded
        END,
        current_stage = current_stage + 1,
        stage_control_timestamp = ?
      WHERE
        hangout_id IN (?);`, [currentTimestamp, hangoutIdsToProgress]);
        ;
        const [hangoutMemberRows] = await db_1.dbPool.query(`SELECT
        hangout_member_id
      FROM
        hangout_members
      WHERE
        hangout_id IN (?);`, [hangoutIdsToProgress]);
        const webSocketData = {
            type: 'hangoutStageUpdate',
            reason: 'hangoutAutoProgressed',
            data: { newStageControlTimestamp: currentTimestamp },
        };
        for (const member of hangoutMemberRows) {
            const ws = hangoutWebSocketServer_1.hangoutClients.get(member.hangout_member_id)?.ws;
            if (!ws) {
                continue;
            }
            ;
            ws.send(JSON.stringify(webSocketData), (err) => err && console.log(err));
        }
        ;
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
        const hangoutIdsToProgress = hangoutRows.map((hangout) => hangout.hangout_id);
        await db_1.dbPool.query(`UPDATE
        hangouts
      SET
        voting_period = (${currentTimestamp} - created_on_timestamp - availability_period - suggestions_period),
        current_stage = ${constants_1.HANGOUT_CONCLUSION_STAGE},
        stage_control_timestamp = ?,
        is_concluded = ?
      WHERE
        hangout_id IN (?);`, [currentTimestamp, true, hangoutIdsToProgress]);
        ;
        const [hangoutMemberRows] = await db_1.dbPool.query(`SELECT
        hangout_member_id
      FROM
        hangout_members
      WHERE
        hangout_id IN (?);`, [hangoutIdsToProgress]);
        const webSocketData = {
            type: 'hangoutStageUpdate',
            reason: 'noSuggestionConclusion',
            data: { newStageControlTimestamp: currentTimestamp },
        };
        for (const member of hangoutMemberRows) {
            const ws = hangoutWebSocketServer_1.hangoutClients.get(member.hangout_member_id)?.ws;
            if (!ws) {
                continue;
            }
            ;
            ws.send(JSON.stringify(webSocketData), (err) => err && console.log(err));
        }
        ;
        const eventDescription = 'Hangout reached the voting stage without any suggestions and was therefore automatically concluded.';
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
