import { Request } from "express";
import { dbPool } from "../db/db";
import { generatePlaceHolders } from "../util/generatePlaceHolders";

export async function logUnexpectedError(req: Request, err: unknown): Promise<void> {
  const currentTimestamp: number = Date.now();
  const { message, trace } = getErrorData(err);

  try {
    await dbPool.execute(
      `INSERT INTO unexpected_errors (
        request_method,
        request_path,
        error_timestamp,
        error_message,
        stack_trace
      ) VALUES (${generatePlaceHolders(5)});`,
      [req.method, req.originalUrl, currentTimestamp, message, trace]
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

function getErrorData(err: unknown): { message: string | null, trace: string | null } {
  const errorData: { message: string | null, trace: string | null } = {
    message: null,
    trace: null,
  };

  if (typeof err !== 'object' || err === null) {
    return errorData;
  };

  if (('message' in err) && typeof err.message === 'string') {
    errorData.message = err.message;
  };

  if (('trace' in err) && typeof err.trace === 'string') {
    errorData.trace = err.trace;
  };

  return errorData;
};