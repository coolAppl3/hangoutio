import { dbPool } from "../db/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE } from "../util/constants";

export async function progressHangouts(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    await dbPool.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        is_concluded = CASE
          WHEN current_stage = ${HANGOUT_VOTING_STAGE} THEN TRUE
          ELSE is_concluded
        END,
        current_stage = current_stage + 1,
        stage_control_timestamp = :currentTimestamp
      WHERE
        (:currentTimestamp - stage_control_timestamp) >= availability_period AND current_stage = ${HANGOUT_AVAILABILITY_STAGE}
        OR
        (:currentTimestamp - stage_control_timestamp) >= suggestions_period AND current_stage = ${HANGOUT_SUGGESTIONS_STAGE}
        OR
        (:currentTimestamp - stage_control_timestamp) >= voting_period AND current_stage = ${HANGOUT_VOTING_STAGE}`,
      { currentTimestamp }
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${progressHangouts.name}`);
    console.log(err);
  };
};

export async function concludeNoSuggestionHangouts(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
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
        hangouts.current_stage = ${HANGOUT_VOTING_STAGE} AND
        suggestions.suggestion_id IS NULL;`
    );

    if (hangoutRows.length === 0) {
      return;
    };

    const hangoutIds: string[] = hangoutRows.map((hangout: HangoutDetails) => hangout.hangout_id);
    const hangoutIdsString: string = `'${hangoutIds.join(`', '`)}'`;

    const [resultSetHeader]: any = await dbPool.execute<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        voting_period = (${currentTimestamp} - created_on_timestamp - availability_period - suggestions_period),
        current_stage = ${HANGOUT_CONCLUSION_STAGE},
        stage_control_timestamp = ?,
        is_concluded = ?
      WHERE
        hangout_id IN (${hangoutIdsString});`,
      [currentTimestamp, true]
    );

    if (resultSetHeader.affectedRows !== hangoutRows.length) {
      console.log(`CRON JOB ERROR: ${concludeNoSuggestionHangouts.name}`);
      console.log({
        timestamp: currentTimestamp,
        expectedAffectedRows: hangoutIds.length,
        affectedRows: resultSetHeader.affectedRows,
        hangoutIds,
        resultSetHeader,
      });
    };

    const eventDescription: string = 'Hangout reached the voting stage without any suggestions, and has therefore been automatically concluded.';

    let hangoutValuesString: string = '';
    for (const id of hangoutIds) {
      hangoutValuesString += `('${id}', '${eventDescription}', ${currentTimestamp}),`;
    };
    hangoutValuesString = hangoutValuesString.slice(0, -1);

    await dbPool.execute(
      `INSERT INTO hangout_events (
        hangout_id,
        event_description,
        event_timestamp
      ) VALUES ${hangoutValuesString};`
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${concludeNoSuggestionHangouts.name}`);
    console.log(err);
  };
};

export async function deleteNoMemberHangouts(): Promise<void> {
  await dbPool.execute(
    `DELETE FROM
    hangouts
      WHERE
    NOT EXISTS (
      SELECT
        1 AS members_exist
      FROM
        hangout_members
      WHERE
        hangout_members.hangout_id = hangouts.hangout_id
    );`
  );
};