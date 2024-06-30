"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.votesRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const requestValidation_1 = require("../util/validation/requestValidation");
const voteServices_1 = require("../services/voteServices");
const authTokenServices_1 = require("../services/authTokenServices");
exports.votesRouter = express_1.default.Router();
exports.votesRouter.post('/', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['authToken', 'hangoutMemberID', 'suggestionID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberID) || !Number.isInteger(requestData.suggestionID)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    const isValidAuthToken = await (0, authTokenServices_1.validateHangoutMemberAuthToken)(res, requestData.authToken, requestData.hangoutMemberID);
    if (!isValidAuthToken) {
        return;
    }
    ;
    const isDuplicateVote = await (0, voteServices_1.checkForDuplicateVote)(res, requestData.hangoutMemberID, requestData.suggestionID);
    if (isDuplicateVote) {
        return;
    }
    ;
    const votesLimitReached = await (0, voteServices_1.checkVotesLimit)(res, requestData.hangoutMemberID);
    if (votesLimitReached) {
        return;
    }
    ;
    try {
        await db_1.dbPool.execute(`INSERT INTO Votes(hangout_member_id, suggestion_id)
      VALUES(?, ?)`, [requestData.hangoutMemberID, requestData.suggestionID]);
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1452) {
            res.status(404).json({ success: false, message: 'Suggestion not found.' });
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
