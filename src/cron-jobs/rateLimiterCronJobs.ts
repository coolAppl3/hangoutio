import { dbPool } from "../db/db";
import { CHAT_REQUESTS_RATE_LIMIT, GENERAL_REQUESTS_RATE_LIMIT, hourMilliseconds, LIGHT_DAILY_RATE_ABUSE_COUNT, minuteMilliseconds } from "../util/constants";

export async function replenishRateRequests(): Promise<void> {
  const currentTimestamp: number = Date.now();

  const generalRequestsToReplenish: number = GENERAL_REQUESTS_RATE_LIMIT / 2;
  const chatRequestsToReplenish: number = CHAT_REQUESTS_RATE_LIMIT / 2;

  try {
    await dbPool.execute(
      `UPDATE
        rate_tracker
      SET
        general_requests_count = GREATEST(general_requests_count - ?, 0),
        chat_requests_count = GREATEST(chat_requests_count - ?, 0)
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

export async function removeLightRateAbusers(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    await dbPool.execute(
      `DELETE FROM
        abusive_users
      WHERE
        rate_limit_reached_count <= ? AND
        ? - latest_abuse_timestamp >= ?;`,
      [LIGHT_DAILY_RATE_ABUSE_COUNT, currentTimestamp, hourMilliseconds]
    );

  } catch (err: unknown) {
    console.log(err);
  };
};