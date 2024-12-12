import { dbPool } from "../db/db";
import { generatePlaceHolders } from "./generatePlaceHolders";

export async function addHangoutEvent(hangoutId: string, eventDescription: string): Promise<void> {
  try {
    await dbPool.execute(
      `INSERT INTO hangout_events (
        hangout_id,
        event_description,
        event_timestamp
      ) VALUES (${generatePlaceHolders(3)});`,
      [hangoutId, eventDescription, Date.now()]
    );

  } catch (err: any) {
    console.log(`HANGOUT EVENT LOGGING ERROR: ${err}`);
  };
};