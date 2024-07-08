"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeAccountRecoveryRow = exports.checkForOngoingRecovery = exports.findAccountIdByEmail = exports.resetFailedSignInAttempts = exports.verifyAccount = exports.deleteAccount = exports.incrementFailedVerificationAttempts = exports.incrementFailedSignInAttempts = exports.incrementVerificationEmailCount = void 0;
const db_1 = require("../db/db");
async function incrementVerificationEmailCount(accountID) {
    try {
        await db_1.dbPool.execute(`UPDATE Accounts
      SET verification_emails_sent = verification_emails_sent + 1
      WHERE account_id = ?;`, [accountID]);
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
      SET failed_sign_in_attempts = failed_sign_in_attempts + 1
      WHERE account_id = ?;`, [accountID]);
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
      WHERE account_id = ?;`, [accountID]);
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
      WHERE account_id = ?;`, [accountID]);
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
      WHERE account_id = ?;`, [accountID]);
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
async function resetFailedSignInAttempts(accountID) {
    try {
        await db_1.dbPool.execute(`UPDATE Accounts
      SET failed_sign_in_attempts = 0
      WHERE account_id = ?;`, [accountID]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.resetFailedSignInAttempts = resetFailedSignInAttempts;
;
async function findAccountIdByEmail(res, email) {
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT account_id FROM Accounts
      WHERE email = ?
      LIMIT 1;`, [email]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return 0;
        }
        ;
        const accountID = rows[0].account_id;
        return accountID;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return 0;
    }
    ;
}
exports.findAccountIdByEmail = findAccountIdByEmail;
;
async function checkForOngoingRecovery(res, accountID) {
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT account_id FROM AccountRecovery
      WHERE account_id = ?
      LIMIT 1;`, [accountID]);
        if (rows.length === 0) {
            return false;
        }
        ;
        return true;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return false;
    }
    ;
}
exports.checkForOngoingRecovery = checkForOngoingRecovery;
;
async function removeAccountRecoveryRow(recoveryToken) {
    try {
        await db_1.dbPool.execute(`DELETE FROM AccountRecovery
      WHERE recovery_token = ?`, [recoveryToken]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.removeAccountRecoveryRow = removeAccountRecoveryRow;
;
