"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMarkedAccounts = exports.removeExpiredEmailUpdateRequests = exports.removeExpiredRecoveryRequests = exports.removeUnverifiedAccounts = void 0;
const db_1 = require("../db/db");
async function removeUnverifiedAccounts() {
    const verificationWindow = 1000 * 60 * 20;
    const minimumAllowedTimestamp = Date.now() - verificationWindow;
    try {
        await db_1.dbPool.execute(`DELETE FROM
        accounts
      WHERE
        is_verified = ? AND
        created_on_timestamp < ?;`, [false, minimumAllowedTimestamp]);
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
    const recoveryWindow = 1000 * 60 * 60;
    const minimumAllowedTimestamp = Date.now() - recoveryWindow;
    try {
        await db_1.dbPool.execute(`DELETE FROM
        account_recovery
      WHERE
        request_timestamp < ?;`, [minimumAllowedTimestamp]);
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
    const updateWindow = 1000 * 60 * 60 * 24;
    const minimumAllowedTimestamp = Date.now() - updateWindow;
    try {
        await db_1.dbPool.execute(`DELETE FROM
        email_update
      WHERE
        request_timestamp < ?;`, [minimumAllowedTimestamp]);
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${removeExpiredEmailUpdateRequests.name}`);
        console.log(err);
    }
    ;
}
exports.removeExpiredEmailUpdateRequests = removeExpiredEmailUpdateRequests;
;
async function deleteMarkedAccounts() {
    const twoDaysMilliseconds = 1000 * 60 * 60 * 24 * 2;
    const minimumAllowedTimestamp = Date.now() - twoDaysMilliseconds;
    ;
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        const [accountRows] = await connection.execute(`SELECT
        account_id
      FROM
        account_deletion
      WHERE
        request_timestamp < ?;`, [minimumAllowedTimestamp]);
        if (accountRows.length === 0) {
            await connection.rollback();
            return;
        }
        ;
        const accountsToDelete = accountRows.map((account) => account.account_id);
        await connection.execute(`DELETE FROM
        accounts
      WHERE
        account_id IN (?);`, [accountsToDelete.join(', ')]);
        await connection.commit();
    }
    catch (err) {
        console.log(`CRON JOB ERROR: ${deleteMarkedAccounts.name}`);
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
    }
    finally {
        if (connection) {
            connection.release();
        }
        ;
    }
    ;
}
exports.deleteMarkedAccounts = deleteMarkedAccounts;
;
