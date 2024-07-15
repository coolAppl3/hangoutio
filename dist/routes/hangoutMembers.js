"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hangoutMembersRouter = void 0;
const db_1 = require("../db/db");
const express_1 = __importDefault(require("express"));
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const hangoutServices_1 = require("../services/hangoutServices");
const authTokenServices_1 = require("../services/authTokenServices");
const userValidation_1 = require("../util/validation/userValidation");
const requestValidation_1 = require("../util/validation/requestValidation");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
exports.hangoutMembersRouter = express_1.default.Router();
exports.hangoutMembersRouter.post('/', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    const requestData = req.body;
    const expectedKeys = ['hangoutID', 'isLeader'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutIDString)(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const isValidHangoutID = await (0, hangoutServices_1.validateHangoutID)(res, requestData.hangoutID);
    if (!isValidHangoutID) {
        return;
    }
    ;
    const isValidAuthToken = await (0, authTokenServices_1.validateAuthToken)(res, authToken);
    if (!isValidAuthToken) {
        return;
    }
    ;
    if (requestData.isLeader) {
        const leaderExists = await (0, hangoutServices_1.hangoutLeaderExists)(res, requestData.hangoutID);
        if (leaderExists) {
            return;
        }
        ;
    }
    ;
    const hangoutMemberLimit = await (0, hangoutServices_1.getHangoutMemberLimit)(res, requestData.hangoutID);
    if (hangoutMemberLimit === 0) {
        return;
    }
    ;
    const hangoutIsFull = await (0, hangoutServices_1.getHangoutCapacity)(res, requestData.hangoutID, hangoutMemberLimit);
    if (hangoutIsFull) {
        return;
    }
    ;
    try {
        const [insertData] = await db_1.dbPool.execute(`INSERT INTO HangoutMembers(
        hangout_id,
        auth_token,
        is_leader
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [requestData.hangoutID, authToken, requestData.isLeader]);
        const hangoutMemberID = insertData.insertId;
        res.json({ success: true, resData: { hangoutMemberID } });
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1452) {
            res.status(404).json({ success: false, message: 'Hangout not found.' });
            return;
        }
        ;
        if (err.errno === 1062) {
            res.status(400).json({ success: false, message: 'You are already a member in this session.' });
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
});
