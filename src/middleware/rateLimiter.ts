import { NextFunction, Request, Response } from "express";
import { getRequestCookie, setResponseCookie } from "../util/cookieUtils";
import { dbPool } from "../db/db";
import { generatePlaceHolders } from "../util/generatePlaceHolders";
import { generateRateLimitId } from "../util/tokenGenerator";
import { RowDataPacket } from "mysql2";
import { CHAT_REQUESTS_RATE_LIMIT, GENERAL_REQUESTS_RATE_LIMIT, hourMilliseconds } from "../util/constants";

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rateLimitId: string | null = getRequestCookie(req, 'rateLimitId');
  const isChatRequest: boolean = checkForChatRequest(req);

  if (!rateLimitId) {
    await addToRateTracker(res, isChatRequest);
    next();

    return;
  };

  if (!isValidRateLimitId(rateLimitId)) {
    await addToRateTracker(res, true);
    next();

    return;
  };

  if (await rateLimitReached(rateLimitId, isChatRequest, res)) {
    res.status(429).json({ message: 'Too many requests.' });
    incrementRequestsCount(rateLimitId, isChatRequest);

    return;
  };

  incrementRequestsCount(rateLimitId, isChatRequest);
  next();
};

async function addToRateTracker(res: Response, isChatRequest: boolean): Promise<void> {
  const newRateId: string = generateRateLimitId();
  const currentTimestamp: number = Date.now();

  try {
    await dbPool.execute(
      `INSERT INTO rate_tracker (
        rate_limit_id,
        general_requests_count,
        chat_requests_count,
        window_timestamp
      ) VALUES(${generatePlaceHolders(4)});`,
      [newRateId, isChatRequest ? 0 : 1, isChatRequest ? 1 : 0, currentTimestamp]
    );

    setResponseCookie(res, 'rateLimitId', newRateId, hourMilliseconds, true);

  } catch (err: unknown) {
    console.log('RATE LIMITING ERROR:', err);
  };
};

async function rateLimitReached(rateLimitId: string, isChatRequest: boolean, res: Response): Promise<boolean> {
  const columnToCheck: string = isChatRequest ? 'chat_requests_count' : 'general_requests_count';

  interface RateTrackerDetails extends RowDataPacket {
    requests_count: number,
  };

  try {
    const [rateTrackerRows] = await dbPool.execute<RateTrackerDetails[]>(
      `SELECT
        ${columnToCheck} AS requests_count
      FROM
        rate_tracker
      WHERE
        rate_limit_id = ?;`,
      [rateLimitId]
    );

    const rateTrackerDetails: RateTrackerDetails | undefined = rateTrackerRows[0];

    if (!rateTrackerDetails) {
      await addToRateTracker(res, isChatRequest);
      return false;
    };

    if (rateTrackerDetails.requests_count > (isChatRequest ? CHAT_REQUESTS_RATE_LIMIT : GENERAL_REQUESTS_RATE_LIMIT)) {
      return true;
    };

    return false;

  } catch (err: unknown) {
    console.log(err);
    return false;
  };
};

async function incrementRequestsCount(rateLimitId: string, isChatRequest: boolean): Promise<void> {
  const columnToUpdate: string = isChatRequest ? 'chat_requests_count' : 'general_requests_count';

  try {
    await dbPool.execute(
      `UPDATE
        rate_tracker
      SET
        ${columnToUpdate} = ${columnToUpdate} + 1
      WHERE
        rate_limit_id = ?;`,
      [rateLimitId]
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

function isValidRateLimitId(rateLimitId: string): boolean {
  if (!rateLimitId.startsWith('r')) {
    return false;
  };

  if (rateLimitId.length !== 32) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9]{32}$/;
  return regex.test(rateLimitId);
};

function checkForChatRequest(req: Request): boolean {
  if (req.path === '/chat' && req.method === 'POST') {
    return true;
  };

  return false;
};