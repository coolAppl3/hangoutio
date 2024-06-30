"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkSuggestionsLimit = void 0;
const db_1 = require("../db/db");
async function checkSuggestionsLimit(res, hangoutMemberID) {
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT suggestion_id FROM Suggestions
      WHERE hangout_member_id = ?`, [hangoutMemberID]);
        if (rows.length >= 3) {
            res.status(400).json({ success: false, message: 'Suggestion limit reached.' });
            return true;
        }
        ;
        return false;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return true;
    }
    ;
}
exports.checkSuggestionsLimit = checkSuggestionsLimit;
;
