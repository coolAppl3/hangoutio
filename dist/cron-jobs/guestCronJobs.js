"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStaleGuestUsers = void 0;
const db_1 = require("../db/db");
const constants_1 = require("../util/constants");
async function deleteStaleGuestUsers() {
    const currentTimestamp = Date.now();
    ;
    const [hangoutRows] = await db_1.dbPool.execute(`SELECT
      hangout_id
    FROM
      hangouts
    WHERE
      is_concluded = ? AND
      (? - stage_control_timestamp) >= ?;`, [true, currentTimestamp, constants_1.dayMilliseconds * 30 * 2]);
    if (hangoutRows.length === 0) {
        return;
    }
    ;
    const hangoutIds = hangoutRows.map((hangout) => hangout.hangout_id);
    if (hangoutIds.length === 0) {
        return;
    }
    ;
    await db_1.dbPool.query(`DELETE FROM
      guests
    WHERE
      hangout_id IN (?)`, [hangoutIds]);
}
exports.deleteStaleGuestUsers = deleteStaleGuestUsers;
;
