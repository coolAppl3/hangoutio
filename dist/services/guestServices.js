"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGuestAccount = void 0;
const tokenGenerator_1 = require("../util/tokenGenerator");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
;
async function createGuestAccount(connection, res, newGuestData, attemptNumber = 1) {
    const authToken = (0, tokenGenerator_1.generateAuthToken)('guest');
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return false;
    }
    ;
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
        await connection.rollback();
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
