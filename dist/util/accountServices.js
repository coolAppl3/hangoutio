"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIncorrectAccountPassword = void 0;
const db_1 = require("../db/db");
const authSessions_1 = require("../auth/authSessions");
const cookieUtils_1 = require("./cookieUtils");
const constants_1 = require("./constants");
async function handleIncorrectAccountPassword(res, accountId, failedSignInAttempts) {
    try {
        await db_1.dbPool.execute(`UPDATE
        accounts
      SET
        failed_sign_in_attempts = failed_sign_in_attempts + 1
      WHERE
        account_id = ?;`, [accountId]);
        const isLocked = failedSignInAttempts + 1 >= constants_1.FAILED_SIGN_IN_LIMIT;
        if (isLocked) {
            await (0, authSessions_1.purgeAuthSessions)(accountId, 'account');
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        }
        ;
        res.status(401).json({
            success: false,
            message: `Incorrect password.${isLocked ? ' Account has been locked.' : ''}`,
            reason: isLocked ? 'accountLocked' : undefined,
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
}
exports.handleIncorrectAccountPassword = handleIncorrectAccountPassword;
;
