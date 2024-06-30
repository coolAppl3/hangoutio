"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkForDuplicateVote = exports.checkVotesLimit = void 0;
const db_1 = require("../db/db");
async function checkVotesLimit(res, hangoutMemberID) {
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT vote_id FROM Votes
      WHERE hangout_member_id = ?`, [hangoutMemberID]);
        if (rows.length >= 3) {
            res.status(400).json({ success: false, message: 'Vote limit reached.' });
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
exports.checkVotesLimit = checkVotesLimit;
;
async function checkForDuplicateVote(res, hangoutMemberID, suggestionID) {
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT vote_id FROM Votes
      WHERE hangout_member_id = ? AND suggestion_id = ?`, [hangoutMemberID, suggestionID]);
        if (rows.length !== 0) {
            res.status(400).json({ success: false, message: 'Duplicate vote.' });
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
exports.checkForDuplicateVote = checkForDuplicateVote;
;
