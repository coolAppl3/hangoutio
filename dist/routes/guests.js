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
    if (!(0, userValidation_1.isValidUsername)(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid username.', reason: 'username' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidPassword)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.', reason: 'password' });
        return;
    }
    ;
    try {
        ;
        const [guestRows] = await db_1.dbPool.execute(`SELECT
        auth_token,
        hangout_id,
        hashed_password
      FROM
        guests
      WHERE
        username = ?
      LIMIT 1;`, [requestData.username]);
        if (guestRows.length === 0) {
            res.status(404).json({ success: false, message: 'Guest account not found.' });
            return;
        }
        ;
        const guestDetails = guestRows[0];
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, guestDetails.hashed_password);
        if (!isCorrectPassword) {
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        res.json({ success: true, resData: { authToken: guestDetails.auth_token, hangoutID: guestDetails.hangout_id } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
