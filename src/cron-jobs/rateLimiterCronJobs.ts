import { dbPool } from "../db/db";
import { CHAT_REQUESTS_RATE_LIMIT, GENERAL_REQUESTS_RATE_LIMIT, minuteMilliseconds } from "../util/constants";

export async function replenishRateRequests(): Promise<void> {
  const currentTimestamp: number = Date.now();

  const generalRequestsToReplenish: number = GENERAL_REQUESTS_RATE_LIMIT / 2;
  const chatRequestsToReplenish: number = CHAT_REQUESTS_RATE_LIMIT / 2;

  try {
    await dbPool.execute(
      `UPDATE
        rate_tracker
      SET
        general_requests_count = general_requests_count - ?,
        chat_requests_count = chat_requests_count - ?
      WHERE
        ? - window_timestamp >= ?;`,
      [generalRequestsToReplenish, chatRequestsToReplenish, currentTimestamp, minuteMilliseconds / 2]
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

export async function removeStaleRateTrackerRows(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    await dbPool.execute(
      `DELETE FROM
        rate_tracker
      WHERE
        ? - window_timestamp >= ? AND
        general_requests_count = 0 AND
        chat_requests_count = 0;`,
      [currentTimestamp, minuteMilliseconds]
    );

  } catch (err: unknown) {
    console.log(err);
  };
};