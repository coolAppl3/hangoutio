import { dbPool } from "../db/db";
import { generatePlaceHolders } from "./generatePlaceHolders";

export async function addHangoutLog(hangoutID: string, logDescription: string): Promise<void> {
  try {
    await dbPool.execute(
      `INSERT INTO hangout_logs(
        hangout_id,
        log_description,
        log_timestamp
      )
      VALUES(${generatePlaceHolders(3)});`,
      [hangoutID, logDescription, Date.now()]
    );

  } catch (err: any) {
    console.log(`HANGOUT LOGGING ERROR: ${err}`);
  };
};