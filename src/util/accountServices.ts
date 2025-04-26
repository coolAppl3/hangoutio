import { Response } from "express";
import { dbPool } from "../db/db";
import { purgeAuthSessions } from "../auth/authSessions";
import { removeRequestCookie } from "./cookieUtils";
import { FAILED_SIGN_IN_LIMIT } from "./constants";

export async function handleIncorrectAccountPassword(res: Response, accountId: number, failedSignInAttempts: number): Promise<void> {
  try {
    await dbPool.execute(
      `UPDATE
        accounts
      SET
        failed_sign_in_attempts = failed_sign_in_attempts + 1
      WHERE
        account_id = ?;`,
      [accountId]
    );

    const isLocked: boolean = failedSignInAttempts + 1 >= FAILED_SIGN_IN_LIMIT;

    if (isLocked) {
      await purgeAuthSessions(accountId, 'account');
      removeRequestCookie(res, 'authSessionId');
    };

    res.status(401).json({
      message: `Incorrect password.${isLocked ? ' Account has been locked.' : ''}`,
      reason: isLocked ? 'accountLocked' : 'incorrectPassword',
    });

  } catch (err: unknown) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error.' });
  };
};