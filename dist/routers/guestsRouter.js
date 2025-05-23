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
const authSessions_1 = require("../auth/authSessions");
const cookieUtils_1 = require("../util/cookieUtils");
const constants_1 = require("../util/constants");
const errorLogger_1 = require("../logs/errorLogger");
exports.guestsRouter = express_1.default.Router();
exports.guestsRouter.post('/signIn', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['username', 'password'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidUsername)(requestData.username)) {
        res.status(400).json({ message: 'Invalid username.', reason: 'invalidUsername' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidPassword)(requestData.password)) {
        res.status(400).json({ message: 'Invalid password.', reason: 'invalidPassword' });
        return;
    }
    ;
    if (typeof requestData.keepSignedIn !== 'boolean') {
        requestData.keepSignedIn = false;
    }
    ;
    try {
        ;
        const [guestRows] = await db_1.dbPool.execute(`SELECT
        guest_id,
        hangout_id,
        hashed_password
      FROM
        guests
      WHERE
        username = ?
      LIMIT 1;`, [requestData.username]);
        const guestDetails = guestRows[0];
        if (!guestDetails) {
            res.status(404).json({ message: 'Guest account not found.' });
            return;
        }
        ;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, guestDetails.hashed_password);
        if (!isCorrectPassword) {
            res.status(401).json({ message: 'Incorrect password.' });
            return;
        }
        ;
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: guestDetails.guest_id,
            user_type: 'guest',
            keepSignedIn: requestData.keepSignedIn,
        });
        if (!authSessionCreated) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to create auth session.' });
            return;
        }
        ;
        const guestHangoutIdCookieMaxAge = requestData.keepSignedIn ? constants_1.hourMilliseconds * 24 * 7 : constants_1.hourMilliseconds * 6;
        (0, cookieUtils_1.setResponseCookie)(res, 'guestHangoutId', guestDetails.hangout_id, guestHangoutIdCookieMaxAge, false);
        res.json({});
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
