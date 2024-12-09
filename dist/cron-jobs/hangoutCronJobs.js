"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveHangouts = exports.deleteNoMemberHangouts = exports.concludeNoSuggestionHangouts = exports.progressHangouts = void 0;
const db_1 = require("../db/db");
async function progressHangouts() {
    const currentTimestamp = Date.now();
    const weekMilliseconds = 1000 * 60 * 60 * 24 * 7;
    try {
        await db_1.dbPool.execute(`UPDATE
        hangouts
      SET
        next_step_timestamp = CASE
          WHEN current_step = 1 THEN suggestions_step + :currentTimestamp
          WHEN current_step = 2 THEN voting_step + :currentTimestamp
          ELSE current_step = :beyondWeekMilliseconds
        END,
        is_concluded = CASE
          WHEN current_step = 3 THEN TRUE
          ELSE is_concluded
        END,
        current_step = CASE
          WHEN current_step < 4 THEN current_step + 1
          ELSE current_step
        END,
        current_step_timestamp = :currentTimestamp
      WHERE
        is_concluded = FALSE AND
        next_step_timestamp <= :currentTimestamp;`, { currentTimestamp, beyondWeekMilliseconds: (currentTimestamp + weekMilliseconds) });
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
        const eventDescription = 'Hangout could not progress into the voting step due to not having any suggestion, and is now concluded as a result.';
        let hangoutValuesString = '';
        for (const id of hangoutIds) {
            hangoutValuesString += `('${id}', '${eventDescription}', ${currentTimestamp}),`;
        }
        ;
        hangoutValuesString = hangoutValuesString.slice(0, -1);
        await db_1.dbPool.execute(`INSERT INTO hangout_events(
        hangout_id,
        event_description,
        event_timestamp
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
async function deleteNoMemberHangouts() {
    await db_1.dbPool.execute(`DELETE
      FROM
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
async function archiveHangouts() {
    const currentTimestamp = Date.now();
    let connection;
    try {
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangouts.hangout_id,
        hangouts.hangout_title,
        hangouts.created_on_timestamp,
        hangouts.conclusion_timestamp,
        COUNT(hangout_members.hangout_member_id) as total_members
      FROM
        hangouts
      LEFT JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangouts.is_concluded = ? AND
        hangouts.next_step_timestamp <= ?
      GROUP BY
        hangouts.hangout_id;`, [true, currentTimestamp]);
        if (hangoutRows.length === 0) {
            return;
        }
        ;
        const hangoutIds = hangoutRows.map((hangout) => hangout.hangout_id);
        const hangoutIdsString = `'${hangoutIds.join(`', '`)}'`;
        ;
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        hangout_id,
        account_id,
        display_name,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id IN (${hangoutIdsString});`);
        let archivedHangoutMembersValues = '';
        for (const member of hangoutMemberRows) {
            archivedHangoutMembersValues += `('${member.hangout_id}', ${member.account_id}, '${member.display_name}', ${member.is_leader}),`;
        }
        ;
        archivedHangoutMembersValues = archivedHangoutMembersValues.slice(0, -1);
        ;
        const [suggestionRows] = await db_1.dbPool.execute(`SELECT
        suggestions.suggestion_id,
        suggestions.hangout_id,
        suggestions.suggestion_title,
        suggestions.suggestion_description,
        COUNT(votes.vote_id) AS votes_count
      FROM
        suggestions
      LEFT JOIN
        votes ON suggestions.suggestion_id = votes.suggestion_id
      WHERE
        suggestions.hangout_id IN (${hangoutIdsString})
      GROUP BY
        suggestions.suggestion_id;`);
        for (const hangout of hangoutRows) {
            const filteredSuggestions = suggestionRows.filter((suggestion) => suggestion.hangout_id === hangout.hangout_id && suggestion.votes_count > 0);
            if (filteredSuggestions.length === 0) {
                hangout.suggestion_title = null;
                hangout.suggestion_description = null;
                continue;
            }
            ;
            const winningSuggestion = getWinningSuggestion(filteredSuggestions);
            if (!winningSuggestion) {
                hangout.suggestion_title = null;
                hangout.suggestion_description = null;
                continue;
            }
            ;
            hangout.suggestion_title = winningSuggestion.suggestion_title;
            hangout.suggestion_description = winningSuggestion.suggestion_description;
        }
        ;
        let archivedHangoutValues = '';
        for (const hangout of hangoutRows) {
            archivedHangoutValues += `('${hangout.hangout_id}', '${hangout.hangout_title}', ${hangout.created_on_timestamp}, ${hangout.conclusion_timestamp}, ${hangout.total_members}, '${hangout.suggestion_title}', '${hangout.suggestion_description}'),`;
        }
        ;
        archivedHangoutValues = archivedHangoutValues.slice(0, -1);
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        await connection.execute(`INSERT INTO hangouts_archive(
        hangout_id,
        hangout_title,
        created_on_timestamp,
        conclusion_timestamp,
        total_members,
        suggestion_title,
        suggestion_description
      )
      VALUES ${archivedHangoutValues};`);
        await connection.execute(`INSERT INTO hangout_members_archive(
        hangout_id,
        account_id,
        display_name,
        is_leader
      )
      VALUES ${archivedHangoutMembersValues};`);
        const [resultSetHeader] = await connection.execute(`DELETE FROM
        hangouts
      WHERE
        hangout_id IN (${hangoutIdsString});`);
        await connection.commit();
        if (resultSetHeader.affectedRows !== hangoutIds.length) {
            ;
            const error = {
                description: 'Incorrect number of hangouts deleted when archiving.',
                timestamp: Date.now(),
                expectedAffectedRows: hangoutIds.length,
                affectedRows: resultSetHeader.affectedRows,
                hangoutIds,
            };
            console.log(`CRON JOB ERROR: ${archiveHangouts.name}`);
            console.log(error);
        }
        ;
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${archiveHangouts.name}`);
        console.log(err);
        await connection?.rollback();
    }
    finally {
        connection?.release();
    }
    ;
}
exports.archiveHangouts = archiveHangouts;
;
;
function getWinningSuggestion(filteredSuggestions) {
    let highestVotesCount = 0;
    let winningSuggestionId = -1;
    for (const suggestion of filteredSuggestions) {
        if (suggestion.votes_count > highestVotesCount) {
            highestVotesCount = suggestion.votes_count;
            winningSuggestionId = suggestion.suggestion_id;
        }
        ;
    }
    ;
    const tieDetected = filteredSuggestions.find((suggestion) => suggestion.votes_count === highestVotesCount && suggestion.suggestion_id !== winningSuggestionId) !== undefined;
    if (tieDetected) {
        return null;
    }
    ;
    const winningSuggestion = filteredSuggestions.find((suggestion) => suggestion.suggestion_id === winningSuggestionId) || null;
    return winningSuggestion;
}
;
