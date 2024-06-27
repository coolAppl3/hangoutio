"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hangoutsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const generateHangoutID_1 = __importDefault(require("../util/generateHangoutID"));
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const requestValidation_1 = require("../util/validation/requestValidation");
exports.hangoutsRouter = express_1.default.Router();
;
;
exports.hangoutsRouter.post('/', async (req, res) => {
    const requestData = req.body;
    const expectedKeys = ['availabilityPeriod', 'suggestionsPeriod', 'votingPeriod', 'approveMembers', 'memberLimit'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    const { availabilityPeriod, suggestionsPeriod, votingPeriod } = requestData;
    if (!(0, hangoutValidation_1.isValidHangoutConfiguration)(availabilityPeriod, suggestionsPeriod, votingPeriod)) {
        res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
        return;
    }
    ;
    if (typeof requestData.approveMembers !== 'boolean') {
        res.status(400).json({ success: false, message: 'Invalid hangout configuration.' });
        return false;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutMemberLimit)(requestData.memberLimit)) {
        res.status(400).json({ success: false, message: 'Invalid hangout member limit.' });
        return;
    }
    ;
    const { status, json } = await createHangout(requestData);
    res.status(status).json(json);
});
async function createHangout(requestData, attemptNumber = 0) {
    const hangoutID = (0, generateHangoutID_1.default)();
    if (attemptNumber > 3) {
        return { status: 500, json: { success: false, message: 'Internal server error.' } };
    }
    ;
    try {
        await db_1.dbPool.execute(`INSERT INTO Hangouts(hangout_id, approve_members, member_limit, availability_period, suggestions_period, voting_period, current_step, created_on_timestamp, completed_on_timestamp)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?);`, [hangoutID, requestData.approveMembers, requestData.memberLimit, requestData.availabilityPeriod, requestData.suggestionsPeriod, requestData.votingPeriod, 1, Date.now(), null]);
        return { status: 200, json: { success: true, resData: { hangoutID } } };
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1062) {
            return await createHangout(requestData, attemptNumber++);
        }
        ;
        if (err.errno === 4025) {
            return { status: 400, json: { success: false, message: 'Invalid step value.' } };
        }
        ;
        if (!err.errno) {
            return { status: 400, json: { success: false, message: 'Invalid request data.' } };
        }
        ;
        return { status: 500, json: { success: false, message: 'Internal server error.' } };
    }
    ;
}
;
