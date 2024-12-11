"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeExpiredDeletionRequests = exports.removeExpiredEmailUpdateRequests = exports.removeExpiredRecoveryRequests = exports.removeUnverifiedAccounts = void 0;
const db_1 = require("../db/db");
async function removeUnverifiedAccounts() {
    const currentTimestamp = Date.now();
    try {
        await db_1.dbPool.execute(`DELETE
        accounts
      FROM
        accounts
      INNER JOIN
        account_verification ON accounts.account_id = account_verification.account_id
      WHERE
        account_verification.expiry_timestamp <= ?;`, [currentTimestamp]);
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${removeUnverifiedAccounts.name}`);
        console.log(err);
    }
    ;
}
exports.removeUnverifiedAccounts = removeUnverifiedAccounts;
;
async function removeExpiredRecoveryRequests() {
    const currentTimestamp = Date.now();
    try {
        await db_1.dbPool.execute(`DELETE FROM
        account_recovery
      WHERE
        expiry_timestamp <= ?;`, [currentTimestamp]);
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${removeExpiredRecoveryRequests.name}`);
        console.log(err);
    }
    ;
}
exports.removeExpiredRecoveryRequests = removeExpiredRecoveryRequests;
;
async function removeExpiredEmailUpdateRequests() {
    const currentTimestamp = Date.now();
    try {
        await db_1.dbPool.execute(`DELETE FROM
        email_update
      WHERE
        expiry_timestamp <= ?;`, [currentTimestamp]);
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${removeExpiredEmailUpdateRequests.name}`);
        console.log(err);
    }
    ;
}
exports.removeExpiredEmailUpdateRequests = removeExpiredEmailUpdateRequests;
;
async function removeExpiredDeletionRequests() {
    const currentTimestamp = Date.now();
    try {
        await db_1.dbPool.execute(`DELETE FROM
        account_deletion
      WHERE
        expiry_timestamp <= ?;`, [currentTimestamp]);
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${removeExpiredDeletionRequests.name}`);
        console.log(err);
    }
    ;
}
exports.removeExpiredDeletionRequests = removeExpiredDeletionRequests;
;
