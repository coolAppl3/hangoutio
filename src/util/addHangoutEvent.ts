import { dbPool } from "../db/db";
import { generatePlaceHolders } from "./generatePlaceHolders";

export async function addHangoutEvent(hangoutId: string, logDescription: string): Promise<void> {
  try {
    await dbPool.execute(
      `INSERT INTO hangout_events(
        hangout_id,
        log_description,
        log_timestamp
      )
      VALUES(${generatePlaceHolders(3)});`,
      [hangoutId, logDescription, Date.now()]
    );

  } catch (err: any) {
    console.log(`HANGOUT EVENT LOGGING ERROR: ${err}`);
  };
};