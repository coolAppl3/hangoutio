import { dbPool } from "../db/db";

export async function progressHangouts(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    await dbPool.query(
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