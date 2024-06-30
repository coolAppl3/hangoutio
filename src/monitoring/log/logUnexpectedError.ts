import { Request } from "express"

interface UnexpectedError {
  timeStamp: number,
  request: {
    originalURL: string,
    headers: any,
    body: any,
  },
  expectedKeys: string[],
  result: any,
};

export function logUnexpectedError(req: Request, expectedKeys: string[], result: any): void {
  const unexpectedError: UnexpectedError = {
    timeStamp: Date.now(),
    request: {
      originalURL: req.originalUrl,
      headers: req.headers,
      body: req.body,
    },
    expectedKeys,
    result,
  };

  console.log(unexpectedError);
};