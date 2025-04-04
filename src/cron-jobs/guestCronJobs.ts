import { RowDataPacket } from "mysql2";
import { dbPool } from "../db/db";
import { dayMilliseconds } from "../util/constants";

export async function deleteStaleGuestUsers(): Promise<void> {
  const currentTimestamp: number = Date.now();

  interface HangoutDetails extends RowDataPacket {
    hangout_id: string,
  };

  const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
    `SELECT
      hangout_id
    FROM
      hangouts
    WHERE
      is_concluded = ? AND
      (? - stage_control_timestamp) >= ?;`,
    [true, currentTimestamp, dayMilliseconds * 30 * 2]
  );

  if (hangoutRows.length === 0) {
    return;
  };

  const hangoutIds: string[] = hangoutRows.map((hangout: HangoutDetails) => hangout.hangout_id);

  if (hangoutIds.length === 0) {
    return;
  };

  await dbPool.query(
    `DELETE FROM
      guests
    WHERE
      hangout_id IN (?)`,
    [hangoutIds]
  );
};