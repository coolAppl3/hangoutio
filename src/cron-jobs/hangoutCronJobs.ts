import { dbPool } from "../db/db";
import { RowDataPacket } from "mysql2";
import { generatePlaceHolders } from "../util/generatePlaceHolders";

export async function progressHangouts(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    await dbPool.execute(
      `UPDATE
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
        next_step_timestamp <= ${currentTimestamp};`
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR (${progressHangouts.name}): ${err}`);
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

    const logDescription: string = 'Hangout progressed into the voting step without any suggestions, and was automatically concluded as a result.';

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
    console.log(`CRON JOB ERROR (${concludeNoSuggestionHangouts.name}): ${err}`)
  };
};