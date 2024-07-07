"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAccount = exports.deleteAccount = exports.incrementFailedVerificationAttempts = exports.incrementFailedSignInAttempts = exports.incrementVerificationEmailCount = void 0;
const db_1 = require("../db/db");
async function incrementVerificationEmailCount(accountID) {
    try {
        await db_1.dbPool.execute(`UPDATE Accounts
      SET verification_emails_sent = verification_emails_sent + 1
      WHERE account_id = ?`, [accountID]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.incrementVerificationEmailCount = incrementVerificationEmailCount;
;
async function incrementFailedSignInAttempts(accountID) {
    try {
        await db_1.dbPool.execute(`UPDATE Accounts
      SET failed_signin_attempts = failed_signin_attempts + 1
      WHERE account_id = ?`, [accountID]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.incrementFailedSignInAttempts = incrementFailedSignInAttempts;
;
async function incrementFailedVerificationAttempts(accountID) {
    try {
        await db_1.dbPool.execute(`UPDATE Accounts
      SET failed_verification_attempts = failed_verification_attempts + 1
      WHERE account_id = ?`, [accountID]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.incrementFailedVerificationAttempts = incrementFailedVerificationAttempts;
;
async function deleteAccount(accountID) {
    try {
        await db_1.dbPool.execute(`DELETE FROM Accounts
      WHERE account_id = ?`, [accountID]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.deleteAccount = deleteAccount;
;
async function verifyAccount(res, accountID) {
    try {
        await db_1.dbPool.execute(`UPDATE Accounts
      SET is_verified = 1
      WHERE account_id = ?`, [accountID]);
        return true;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return false;
    }
    ;
}
exports.verifyAccount = verifyAccount;
;
