"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestionsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const requestValidation_1 = require("../util/validation/requestValidation");
const userValidation_1 = require("../util/validation/userValidation");
const suggestionsValidation_1 = require("../util/validation/suggestionsValidation");
const authTokenServices_1 = require("../services/authTokenServices");
const suggestionServices_1 = require("../services/suggestionServices");
exports.suggestionsRouter = express_1.default.Router();
exports.suggestionsRouter.post('/', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['authToken', 'hangoutMemberID', 'suggestionTitle', 'suggestionDescription'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidAuthTokenString)(requestData.authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.hangoutMemberID)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const isValidAuthToken = await (0, authTokenServices_1.validateHangoutMemberAuthToken)(res, requestData.authToken, requestData.hangoutMemberID);
    if (!isValidAuthToken) {
        return;
    }
    ;
    if (!(0, suggestionsValidation_1.isValidSuggestionTitle)(requestData.suggestionTitle)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion title.' });
        return;
    }
    ;
    if (!(0, suggestionsValidation_1.isValidSuggestionDescription)(requestData.suggestionDescription)) {
        res.status(400).json({ success: false, message: 'Invalid suggestion description.' });
        return;
    }
    ;
    const suggestionsLimitReached = await (0, suggestionServices_1.checkSuggestionsLimit)(res, requestData.hangoutMemberID);
    if (suggestionsLimitReached) {
        return;
    }
    ;
    try {
        await db_1.dbPool.execute(`INSERT INTO Suggestions(hangout_member_id, suggestion_title, suggestion_description)
      VALUES(?, ?, ?)`, [requestData.hangoutMemberID, requestData.suggestionTitle, requestData.suggestionDescription]);
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
