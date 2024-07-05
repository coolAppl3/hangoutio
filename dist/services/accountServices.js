"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementVerificationEmailCount = void 0;
const db_1 = require("../db/db");
async function incrementVerificationEmailCount(accountID, emailsSentCount) {
    if (emailsSentCount > 3) {
        return;
    }
    ;
    try {
        await db_1.dbPool.execute(`UPDATE Accounts
      SET verification_emails_sent = ?
      WHERE account_id = ?`, [++emailsSentCount, accountID]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.incrementVerificationEmailCount = incrementVerificationEmailCount;
;
