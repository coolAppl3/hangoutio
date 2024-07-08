"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hangoutsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const generateHangoutID_1 = __importDefault(require("../util/generators/generateHangoutID"));
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const requestValidation_1 = require("../util/validation/requestValidation");
const generatePlaceHolders_1 = require("../util/generators/generatePlaceHolders");
exports.hangoutsRouter = express_1.default.Router();
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
    await createHangout(res, requestData);
});
async function createHangout(res, requestData, attemptNumber = 0) {
    const hangoutID = (0, generateHangoutID_1.default)();
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
    try {
        await db_1.dbPool.execute(`INSERT INTO Hangouts(
        hangout_id,
        approve_members,
        member_limit,
        availability_period,
        suggestions_period,
        voting_period,
        current_step,
        created_on_timestamp,
        completed_on_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(9)});`, [hangoutID, requestData.approveMembers, requestData.memberLimit, requestData.availabilityPeriod, requestData.suggestionsPeriod, requestData.votingPeriod, 1, Date.now(), null]);
        res.json({ success: true, resData: { hangoutID } });
        return;
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1062) {
            return await createHangout(res, requestData, ++attemptNumber);
        }
        ;
        if (err.errno === 4025) {
            res.status(400).json({ success: false, message: 'Invalid step value.' });
            return;
        }
        ;
        if (!err.errno) {
            res.status(400).json({ success: false, message: 'Invalid request data.' });
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
}
;
