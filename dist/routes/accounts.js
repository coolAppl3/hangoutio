"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const authTokens_1 = require("../util/authTokens");
const userValidation_1 = require("../util/validation/userValidation");
const passwordServices_1 = require("../services/passwordServices");
const requestValidation_1 = require("../util/validation/requestValidation");
exports.accountsRouter = express_1.default.Router();
;
;
exports.accountsRouter.post('/signUp', async (req, res) => {
    const requestData = req.body;
    const expectedKeys = ['email', 'password', 'userName'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidEmail)(requestData.email)) {
        res.status(400).json({ success: false, message: 'Invalid email address.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidPassword)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidName)(requestData.userName)) {
        res.status(400).json({ success: false, message: 'Invalid account name.' });
        return;
    }
    ;
    const hashedPassword = await (0, passwordServices_1.getHashedPassword)(res, requestData.password);
    if (hashedPassword === '') {
        return;
    }
    ;
    const { status, json } = await createAccount(requestData, hashedPassword);
    res.status(status).json(json);
});
async function createAccount(requestData, hashedPassword, attemptNumber = 1) {
    const authToken = (0, authTokens_1.generateAuthToken)('account');
    if (attemptNumber > 3) {
        return { status: 500, json: { success: false, message: 'Internal server error.' } };
    }
    ;
    try {
        await db_1.dbPool.execute(`INSERT INTO Accounts(auth_token, email, password_hash, user_name, is_verified, created_on_timestamp, friends)
      VALUES(?, ?, ?, ?, ?, ?, ?);`, [authToken, requestData.email, hashedPassword, requestData.userName, false, Date.now(), '']);
        return { status: 200, json: { success: true, resData: { authToken } } };
    }
    catch (err) {
        console.log(err);
        if (!err.errno) {
            return { status: 400, json: { success: false, message: 'Invalid request data.' } };
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
            return { status: 409, json: { success: false, message: 'Email address is already in use.' } };
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
            return await createAccount(requestData, hashedPassword, attemptNumber++);
        }
        ;
        return { status: 500, json: { success: false, message: 'Internal server error.' } };
    }
    ;
}
;
