"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guestsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const userValidation_1 = require("../util/validation/userValidation");
const authTokens_1 = require("../util/authTokens");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const passwordServices_1 = require("../services/passwordServices");
const requestValidation_1 = require("../util/validation/requestValidation");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
exports.guestsRouter = express_1.default.Router();
;
exports.guestsRouter.post('/', async (req, res) => {
    const requestData = req.body;
    const expectedKeys = ['userName', 'password', 'hangoutID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidName)(requestData.userName)) {
        res.status(400).json({ success: false, message: 'Invalid guest name.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidPassword)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutIDString)(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    const hashedPassword = await (0, passwordServices_1.getHashedPassword)(res, requestData.password);
    if (hashedPassword === '') {
        return;
    }
    ;
    await createGuest(res, requestData, hashedPassword);
});
async function createGuest(res, requestData, hashedPassword, attemptNumber = 1) {
    const authToken = (0, authTokens_1.generateAuthToken)('guest');
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
    try {
        const [insertData] = await db_1.dbPool.execute(`INSERT INTO Guests(
        auth_token,
        user_name,
        password_hash,
        hangout_id
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)});`, [authToken, requestData.userName, hashedPassword, requestData.hangoutID]);
        const guestID = insertData.insertId;
        res.json({ success: true, resData: { guestID, authToken } });
    }
    catch (err) {
        console.log(err);
        if (!err.errno) {
            res.status(400).json({ success: false, message: 'Invalid request data.' });
            return;
        }
        ;
        if (err.errno === 1452) {
            res.status(404).json({ succesS: false, message: 'Hangout not found.' });
            return;
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
            return await createGuest(res, requestData, hashedPassword, ++attemptNumber);
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
}
;
