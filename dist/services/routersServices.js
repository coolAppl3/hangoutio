"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHangout = exports.createGuestAccount = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const tokenGenerator_1 = require("../util/tokenGenerator");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
;
async function createGuestAccount(connection, res, newGuestData, attemptNumber = 1) {
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return false;
    }
    ;
    const authToken = (0, tokenGenerator_1.generateAuthToken)('guest');
    try {
        await connection.execute(`INSERT INTO Guests(
        auth_token,
        user_name,
        hashed_password,
        hangout_id
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)});`, [authToken, newGuestData.userName, newGuestData.hashedPassword, newGuestData.hangoutID]);
        return authToken;
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (err.errno === 1452) {
            res.status(404).json({ succesS: false, message: 'Hangout not found.' });
            return false;
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
            return await createGuestAccount(connection, res, newGuestData, ++attemptNumber);
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return false;
    }
    ;
}
exports.createGuestAccount = createGuestAccount;
;
;
async function createHangout(connection, res, NewHangoutData, attemptNumber = 1) {
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return false;
    }
    ;
    const hangoutID = (0, tokenGenerator_1.generateHangoutID)();
    try {
        let hashedPassword = null;
        if (NewHangoutData.hangoutPassword) {
            hashedPassword = await bcrypt_1.default.hash(NewHangoutData.hangoutPassword, 10);
        }
        ;
        await connection.execute(`INSERT INTO Hangouts(
        hangout_id,
        hashed_password,
        member_limit,
        availability_period,
        suggestions_period,
        voting_period,
        current_step,
        step_timestamp,
        created_on_timestamp,
        completed_on_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(10)});`, [hangoutID, hashedPassword, NewHangoutData.memberLimit, NewHangoutData.availabilityPeriod, NewHangoutData.suggestionsPeriod, NewHangoutData.votingPeriod, 1, Date.now(), Date.now(), null]);
        return hangoutID;
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (err.errno === 1062) {
            return await createHangout(connection, res, NewHangoutData, ++attemptNumber);
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return false;
    }
    ;
}
exports.createHangout = createHangout;
;
