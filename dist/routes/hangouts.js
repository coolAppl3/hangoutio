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
exports.hangoutsRouter = express_1.default.Router();
;
;
exports.hangoutsRouter.post('/', async (req, res) => {
    const requestData = req.body;
    if (!(0, hangoutValidation_1.isValidHangoutConfiguration)(requestData.availabilityPeriod, requestData.suggestionsPeriod, requestData.votingPeriod)) {
        res.status(400).json({ success: false, message: 'Invalid hangout data.' });
        return;
    }
    ;
    const { status, json } = await createHangout(requestData);
    res.status(status).json(json);
});
async function createHangout(requestData, attemptNumber = 0) {
    const hangoutID = (0, generateHangoutID_1.default)();
    if (attemptNumber > 3) {
        return { status: 500, json: { success: false, message: 'Something went wrong.' } };
    }
    ;
    try {
        await db_1.dbPool.execute(`INSERT INTO Hangouts(hangout_id, approve_members, availability_period, suggestions_period, voting_period, current_step, created_on_timestamp, completed_on_timestamp)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, [hangoutID, Boolean(requestData.approveMembers), Math.floor(requestData.availabilityPeriod), Math.floor(requestData.suggestionsPeriod), Math.floor(requestData.votingPeriod), 1, Date.now(), null]);
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
        return { status: 500, json: { success: false, message: 'Something went wrong.' } };
    }
    ;
}
;
