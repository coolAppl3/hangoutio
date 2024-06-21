"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guestsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const userValidation_1 = require("../util/validation/userValidation");
const generateAuthToken_1 = require("../util/generateAuthToken");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const passwordHash_1 = require("../util/passwordHash");
exports.guestsRouter = express_1.default.Router();
;
;
exports.guestsRouter.post('/', async (req, res) => {
    const requestData = req.body;
    if (!(0, userValidation_1.isValidName)(requestData.guestName)) {
        res.status(400).json({ success: false, message: 'Invalid guest name.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidPassword)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutID)(requestData.hangoutID)) {
        res.status(400).json({ success: false, message: 'Invalid hangout ID.' });
        return;
    }
    ;
    const hashedPassword = await (0, passwordHash_1.hashPassword)(requestData.password);
    if (passwordHash_1.hashPassword.length === 0) {
        res.status(500).json({ success: false, message: 'Something went wrong.' });
        return;
    }
    ;
    const { status, json } = await createGuest(requestData, hashedPassword);
    res.status(status).json(json);
});
async function createGuest(requestData, hashedPassword, attemptNumber = 1) {
    const authToken = (0, generateAuthToken_1.generateGuestAuthToken)();
    if (attemptNumber > 3) {
        return { status: 500, json: { success: false, message: 'Something went wrong.' } };
    }
    ;
    try {
        const [insertData] = await db_1.dbPool.execute(`INSERT INTO Guests(auth_token, guest_name, password_hash, hangout_id)
      VALUES(?, ?, ?, ?)`, [authToken, requestData.guestName, hashedPassword, requestData.hangoutID]);
        const guestID = insertData.insertId;
        return { status: 200, json: { success: true, resData: { guestID, authToken } } };
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1452) {
            return { status: 400, json: { success: false, message: 'Hangout ID does not exist.' } };
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
            return await createGuest(requestData, hashedPassword, attemptNumber++);
        }
        ;
        return { status: 500, json: { success: false, message: 'Something went wrong.' } };
    }
    ;
}
;
