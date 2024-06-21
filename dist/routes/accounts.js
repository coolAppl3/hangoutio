"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const generateAuthToken_1 = require("../util/generateAuthToken");
const userValidation_1 = require("../util/validation/userValidation");
const passwordHash_1 = require("../util/passwordHash");
const bcryptSaltRounds = 10;
exports.accountsRouter = express_1.default.Router();
;
;
exports.accountsRouter.post('/signUp', async (req, res) => {
    const requestData = req.body;
    if (!(0, userValidation_1.isValidEmail)(requestData.email)) {
        res.status(400).json({ success: false, message: 'Invalid email address.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidName)(requestData.accountName)) {
        res.status(400).json({ success: false, message: 'Invalid account name.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidPassword)(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    const hashedPassword = await (0, passwordHash_1.hashPassword)(requestData.password);
    if (passwordHash_1.hashPassword.length === 0) {
        res.status(500).json({ success: false, message: 'Something went wrong.' });
        return;
    }
    ;
    const { status, json } = await createAccount(requestData, hashedPassword);
    res.status(status).json(json);
});
async function createAccount(requestData, hashedPassword, attemptNumber = 1) {
    const authToken = (0, generateAuthToken_1.generateAccountAuthToken)();
    if (attemptNumber > 3) {
        return { status: 500, json: { success: false, message: 'Something went wrong.' } };
    }
    ;
    try {
        await db_1.dbPool.execute(`INSERT INTO Accounts(auth_token, email, password_hash, account_name, is_verified, created_on_timestamp, friends)
      VALUES(?, ?, ?, ?, ?, ?, ?)`, [authToken, requestData.email, hashedPassword, requestData.accountName, false, Date.now(), '']);
        return { status: 200, json: { success: true, resData: { authToken } } };
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
            return { status: 409, json: { success: false, message: 'Email address is already in use.' } };
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
            return await createAccount(requestData, hashedPassword, attemptNumber++);
        }
        ;
        return { status: 500, json: { success: false, message: 'Something went wrong.' } };
    }
    ;
}
;
