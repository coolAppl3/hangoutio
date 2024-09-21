import { dbPool } from "../db/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";

export async function progressHangouts(): Promise<void> {
  const currentTimestamp: number = Date.now();
  const weekMilliseconds: number = 1000 * 60 * 60 * 24 * 7

  try {
    await dbPool.execute(
      `UPDATE
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
        next_step_timestamp <= ${currentTimestamp};`
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${progressHangouts.name}`)
    console.log(err);
  };
};

export async function concludeNoSuggestionHangouts(): Promise<void> {
  try {
    const currentTimestamp: number = Date.now();

    interface HangoutDetails extends RowDataPacket {
      hangout_id: string,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.hangout_id
      FROM
        hangouts
      LEFT JOIN
        suggestions ON hangouts.hangout_id = suggestions.hangout_id
      WHERE
        hangouts.current_step = 3 AND
        suggestions.suggestion_id IS NULL;`
    );

    if (hangoutRows.length === 0) {
      return;
    };

    const hangoutIds: string[] = hangoutRows.map((hangout: HangoutDetails) => hangout.hangout_id);
    const hangoutIdsString: string = `'${hangoutIds.join(`', '`)}'`;

    const [resultSetHeader]: any = await dbPool.execute(
      `UPDATE
        hangouts
      SET
        current_step = ?,
        current_step_timestamp = ?,
        next_step_timestamp = ?,
        conclusion_timestamp = ?,
        is_concluded = ?
      WHERE
        hangout_id IN (${hangoutIdsString});`,
      [4, currentTimestamp, null, currentTimestamp, true]
    );

    if (resultSetHeader.affectedRows !== hangoutRows.length) {
      console.log(`CRON JOB ERROR: ${concludeNoSuggestionHangouts.name}`)
      console.log({
        resultSetHeader,
        hangoutIds,
      })
    };

    const logDescription: string = 'Hangout could not progress into the voting step due to not having any suggestion, and is now concluded as a result.';

    let hangoutValuesString: string = '';
    for (const id of hangoutIds) {
      hangoutValuesString += `('${id}', '${logDescription}', ${currentTimestamp}),`;
    };
    hangoutValuesString = hangoutValuesString.slice(0, -1);

    await dbPool.execute(
      `INSERT INTO hangout_logs(
        hangout_id,
        log_description,
        log_timestamp
      )
      VALUES ${hangoutValuesString};`
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${concludeNoSuggestionHangouts.name}`)
    console.log(err);
  };
};

export async function archiveHangouts(): Promise<void> {
  const currentTimestamp: number = Date.now();

  let connection;

  try {
    interface HangoutDetails extends RowDataPacket {
      hangout_id: string,
      created_on_timestamp: number,
      conclusion_timestamp: number,
      total_members: number,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.hangout_id,
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
        hangouts.hangout_id;`,
      [true, currentTimestamp]
    );

    if (hangoutRows.length === 0) {
      return;
    };

    const hangoutIds: string[] = hangoutRows.map((hangout: HangoutDetails) => hangout.hangout_id);
    const hangoutIdsString: string = `'${hangoutIds.join(`', '`)}'`;
    console.log(hangoutIdsString)

    interface HangoutMember extends RowDataPacket {
      hangout_id: string,
      account_id: number | null,
      display_name: string,
      is_leader: boolean,
    };

    const [hangoutMemberRows] = await dbPool.execute<HangoutMember[]>(
      `SELECT
        hangout_id,
        account_id,
        display_name,
        is_leader
      FROM
        hangout_members
      WHERE
        hangout_id IN (${hangoutIdsString});`
    );

    let archivedHangoutMembersValues: string = '';
    for (const member of hangoutMemberRows) {
      archivedHangoutMembersValues += `('${member.hangout_id}', ${member.account_id}, '${member.display_name}', ${member.is_leader}),`;
    };
    archivedHangoutMembersValues = archivedHangoutMembersValues.slice(0, -1);

    interface Suggestion extends RowDataPacket {
      suggestion_id: number,
      hangout_id: string,
      suggestion_title: string,
      suggestion_description: string,
      votes_count: number,
    };

    const [suggestionRows] = await dbPool.execute<Suggestion[]>(
      `SELECT
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
        suggestions.suggestion_id;`
    );

    for (const hangout of hangoutRows) {
      const filteredSuggestions: Suggestion[] = suggestionRows.filter((suggestion: Suggestion) => suggestion.hangout_id === hangout.hangout_id && suggestion.votes_count > 0);

      if (filteredSuggestions.length === 0) {
        hangout.suggestion_title = null;
        hangout.suggestion_description = null;

        continue;
      };

      const winningSuggestion: Suggestion | null = getWinningSuggestion(filteredSuggestions);
      if (!winningSuggestion) {
        hangout.suggestion_title = null;
        hangout.suggestion_description = null;

        continue;
      };

      hangout.suggestion_title = winningSuggestion.suggestion_title;
      hangout.suggestion_description = winningSuggestion.suggestion_description;
    };

    let archivedHangoutValues: string = '';
    for (const hangout of hangoutRows) {
      archivedHangoutValues += `('${hangout.hangout_id}', ${hangout.created_on_timestamp}, ${hangout.conclusion_timestamp}, ${hangout.total_members}, '${hangout.suggestion_title}', '${hangout.suggestion_description}'),`;
    };
    archivedHangoutValues = archivedHangoutValues.slice(0, -1);

    connection = await dbPool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `INSERT INTO hangouts_archive(
        hangout_id,
        created_on_timestamp,
        conclusion_timestamp,
        total_members,
        suggestion_title,
        suggestion_description
      )
      VALUES ${archivedHangoutValues};`
    );

    await connection.execute(
      `INSERT INTO hangout_members_archive(
        hangout_id,
        account_id,
        display_name,
        is_leader
      )
      VALUES ${archivedHangoutMembersValues}`
    );

    const [resultSetHeader] = await connection.execute<ResultSetHeader>(
      `DELETE FROM
        hangouts
      WHERE
        hangout_id IN (${hangoutIdsString});`
    );

    if (resultSetHeader.affectedRows !== hangoutIds.length) {
      interface Error {
        description: string,
        timestamp: number,
        expectedAffectedRows: number,
        affectedRows: number,
        hangoutIds: string[],
      };

      const error: Error = {
        description: 'Incorrect number of hangouts deleted when archiving.',
        timestamp: Date.now(),
        expectedAffectedRows: hangoutIds.length,
        affectedRows: resultSetHeader.affectedRows,
        hangoutIds,
      };

      console.log(`CRON JOB ERROR: ${archiveHangouts.name}`);
      console.log(error);
    };

    await connection.commit();

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${archiveHangouts.name}`);
    console.log(err);

    if (connection) {
      await connection.rollback();
    };

  } finally {
    if (connection) {
      connection.release();
    };
  };
};

interface Suggestion extends RowDataPacket {
  suggestion_id: number,
  hangout_id: string,
  suggestion_title: string,
  suggestion_description: string,
  votes_count: number,
};

function getWinningSuggestion(filteredSuggestions: Suggestion[]): Suggestion | null {
  let highestVotesCount: number = 0
  let winningSuggestionID: number = -1;

  for (const suggestion of filteredSuggestions) {
    if (suggestion.votes_count > highestVotesCount) {
      highestVotesCount = suggestion.votes_count;
      winningSuggestionID = suggestion.suggestion_id;
    };
  };

  const tieDetected: boolean = filteredSuggestions.find((suggestion: Suggestion) => suggestion.votes_count === highestVotesCount && suggestion.suggestion_id !== winningSuggestionID) !== undefined;
  if (tieDetected) {
    return null;
  };

  const winningSuggestion: Suggestion | null = filteredSuggestions.find((suggestion: Suggestion) => suggestion.suggestion_id === winningSuggestionID) || null;

  return winningSuggestion;
};