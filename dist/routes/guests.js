"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.guestsRouter = void 0;
const db_1 = require("../db/db");
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const requestValidation_1 = require("../util/validation/requestValidation");
const userValidation_1 = require("../util/validation/userValidation");
exports.guestsRouter = express_1.default.Router();
exports.guestsRouter.post('/signIn', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['username', 'password'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidUsernameString)(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid username.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidPasswordString)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        auth_token,
        hangout_id,
        hashed_password
      FROM
        Guests
      WHERE
        username = ?
      LIMIT 1;`);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Guest account not found.' });
            return;
        }
        ;
        ;
        const guestDetails = {
            authToken: rows[0].auth_token,
            hangoutID: rows[0].hangout_id,
            hashedPassword: rows[0].hashed_password,
        };
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, guestDetails.hashedPassword);
        if (!isCorrectPassword) {
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        res.json({ success: true, resData: { authToken: guestDetails.authToken, hangoutID: guestDetails.hangoutID } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
