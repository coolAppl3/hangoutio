"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hangoutMembersRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const userValidation_1 = require("../util/validation/userValidation");
exports.hangoutMembersRouter = express_1.default.Router();
;
;
exports.hangoutMembersRouter.post('/', async (req, res) => {
    const requestData = req.body;
    if (!(0, hangoutValidation_1.isValidHangoutID)(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidUserType)(requestData.userType)) {
        res.status(400).json({ success: false, message: 'Invalid user type.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.userID)) {
        res.status(400).json({ success: false, message: 'Invalid user ID.' });
        return;
    }
    ;
    const { status, json } = await createHangoutMember(requestData);
    res.status(status).json(json);
});
async function createHangoutMember(requestData) {
    try {
        const [insertData] = await db_1.dbPool.execute(`INSERT INTO HangoutMembers(hangout_id, user_type, user_id, is_leader)
      VALUES(?, ?, ?, ?)`, [requestData.hangoutID, requestData.userType, Math.floor(requestData.userID), Boolean(requestData.isLeader)]);
        const hangoutMemberID = insertData.insertId;
        return { status: 200, json: { success: true, resData: { hangoutMemberID } } };
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1452) {
            return { status: 400, json: { success: false, message: 'Hangout ID does not exist.' } };
        }
        ;
        if (err.errno === 1062) {
            return { status: 409, json: { success: false, message: 'User is already a part of this hangout.' } };
        }
        ;
        return { status: 500, json: { success: false, message: 'Something went wrong.' } };
    }
    ;
}
;
