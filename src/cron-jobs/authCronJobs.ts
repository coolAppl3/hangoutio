import { dbPool } from "../db/db";
import { ResultSetHeader } from "mysql2";

export async function clearExpiredAuthSessions(): Promise<void> {
  try {
    const currentTimestamp: number = Date.now();
    await dbPool.execute<ResultSetHeader>(
      `DELETE FROM
        auth_sessions
      WHERE
        expiry_timestamp >= ?;`,
      [currentTimestamp]
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${clearExpiredAuthSessions.name}`)
    console.log(err);
  };
};