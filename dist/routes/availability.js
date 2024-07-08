"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const timeSlotValidation_1 = require("../util/validation/timeSlotValidation");
const authTokenServices_1 = require("../services/authTokenServices");
const userValidation_1 = require("../util/validation/userValidation");
const requestValidation_1 = require("../util/validation/requestValidation");
const generatePlaceHolders_1 = require("../util/generators/generatePlaceHolders");
exports.availabilityRouter = express_1.default.Router();
exports.availabilityRouter.post('/', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    const requestData = req.body;
    const expectedKeys = ['hangoutMemberID', 'dateString', 'dateTimestamp', 'slots'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const isValidAuthToken = await (0, authTokenServices_1.validateHangoutMemberAuthToken)(res, authToken, requestData.hangoutMemberID);
    if (!isValidAuthToken) {
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberID)) {
        res.status(400).json({ success: false, message: 'Invalid user ID.' });
        return;
    }
    ;
    if (typeof requestData.dateString !== 'string') {
        res.status(400).json({ success: false, message: 'Invalid date string.' });
    }
    ;
    const minimumDateStringLength = 11;
    if (requestData.dateString.length < minimumDateStringLength) {
        res.status(400).json({ success: false, message: 'Invalid date string.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.dateTimestamp)) {
        res.status(400).json({ success: false, message: 'Invalid date.' });
        return;
    }
    ;
    if (!(0, timeSlotValidation_1.isValidTimeSlotsString)(requestData.slots)) {
        res.status(400).json({ success: false, message: 'Invalid time slots.' });
        return;
    }
    ;
    try {
        await db_1.dbPool.execute(`INSERT INTO Availability(
        hangout_member_id,
        date_string,
        date_timestamp,
        slots
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)})`, [requestData.hangoutMemberID, requestData.dateString, requestData.dateTimestamp, requestData.slots]);
        res.json({ success: true, requestData: {} });
    }
    catch (err) {
        console.log(err);
        if (!err.errno) {
            res.status(400).json({ success: false, message: 'Invalid request data.' });
            return;
        }
        ;
        if (err.errno === 1062) {
            res.status(409).json({ success: false, message: 'User already has an availability row.' });
            return;
        }
        ;
        if (err.errno === 1452) {
            res.status(404).json({ success: false, message: 'Hangout member ID not found.' });
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
