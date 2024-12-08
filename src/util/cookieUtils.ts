import { CookieOptions, Request, Response } from "express";

type AllowedCookieNames = 'authSessionId' | 'guestHangoutId' | 'signedInAs';

export function setResponseCookie(res: Response, cookieName: AllowedCookieNames, cookieValue: string, maxAge: number, httpOnly: boolean): void {
  const cookieOptions: CookieOptions = {
    httpOnly,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge,
  };

  res.cookie(cookieName, cookieValue, cookieOptions);
};

export function getRequestCookie(req: Request, cookieName: AllowedCookieNames): string | null {
  const requestCookies: Record<string, any> = req.cookies;

  if (requestCookies[cookieName]) {
    return requestCookies.cookieName;
  };

  return null;
};

export function removeRequestCookie(res: Response, cookieName: AllowedCookieNames, httpOnly: boolean): void {
  res.clearCookie(cookieName, {
    httpOnly,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
};