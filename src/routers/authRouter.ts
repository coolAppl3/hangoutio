import express, { Router, Request, Response } from "express";
import { removeRequestCookie, getRequestCookie } from "../util/cookieUtils";
import { destroyAuthSession } from "../auth/authSessions";

export const authRouter: Router = express.Router();

authRouter.post('/signOut', async (req: Request, res: Response) => {
  const authSessionId: string | null = getRequestCookie(req, 'authSessionId');

  if (!authSessionId) {
    res.status(409).json({ message: 'Not signed in.' });
    return;
  };

  try {
    removeRequestCookie(res, 'authSessionId');
    await destroyAuthSession(authSessionId);

    res.json({});

  } catch (err: unknown) {
    console.log(err);

    if (res.headersSent) {
      return;
    };

    res.status(500).json({ message: 'Internal server error.' });
  };
});