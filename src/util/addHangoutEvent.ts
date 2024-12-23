import { dbPool } from "../db/db";
import { generatePlaceHolders } from "./generatePlaceHolders";

export async function addHangoutEvent(hangoutId: string, eventDescription: string, specificTimestamp?: number): Promise<void> {
  const timestamp: number = specificTimestamp || Date.now();

  try {
    await dbPool.execute(
      `INSERT INTO hangout_events (
        hangout_id,
        event_description,
        event_timestamp
      ) VALUES (${generatePlaceHolders(3)});`,
      [hangoutId, eventDescription, timestamp]
    );

  } catch (err: any) {
    console.log(`HANGOUT EVENT LOGGING ERROR: ${err}`);
  };
};