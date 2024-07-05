"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const userValidation_1 = require("../util/validation/userValidation");
const passwordServices_1 = require("../services/passwordServices");
const requestValidation_1 = require("../util/validation/requestValidation");
const emailServices_1 = require("../services/emailServices");
const accountServices_1 = require("../services/accountServices");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const generateVerificationCode_1 = require("../util/generateVerificationCode");
exports.accountsRouter = express_1.default.Router();
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
    await createAccount(res, requestData, hashedPassword);
});
async function createAccount(res, requestData, hashedPassword, attemptNumber = 1) {
    const authToken = 'aT35BHYlHiHiXxuXjDGLyxk2xQk8KIS7';
    const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)();
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server errorrrrr.' });
        return;
    }
    ;
    try {
        const [insertData] = await db_1.dbPool.execute(`INSERT INTO Accounts(
        auth_token,
        email,
        user_name,
        password_hash,
        created_on_timestamp,
        friends,
        verification_code,
        is_verified,
        verification_emails_sent,
        failed_verification_attempts,
        is_locked,
        failed_signin_attempts,
        recovery_email_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(13)});`, [authToken, requestData.email, requestData.userName, hashedPassword, Date.now(), '', verificationCode, false, 1, 0, false, 0, 0]);
        res.json({ success: true, resData: { authToken } });
        const accountID = insertData.insertId;
        await (0, emailServices_1.sendVerificationEmail)(requestData.email, accountID, verificationCode);
    }
    catch (err) {
        console.log(err);
        if (!err.errno) {
            res.status(400).json({ success: false, message: 'Invalid request data.' });
            return;
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
            res.status(409).json({ success: false, message: 'Email address is already in use.' });
            return;
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
            return await createAccount(res, requestData, hashedPassword, ++attemptNumber);
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
}
;
exports.accountsRouter.get('/resendVerificationCode', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken) || authToken[0] !== 'a') {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    let accountID;
    let accountEmail;
    let verificationCode;
    let verificationEmailsSent;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT account_id, email, verification_code, verification_emails_sent FROM Accounts
      WHERE auth_token = ? LIMIT 1`, [authToken]);
        if (rows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        accountID = rows[0].account_id;
        accountEmail = rows[0].email;
        verificationCode = rows[0].verification_code;
        verificationEmailsSent = rows[0].verification_emails_sent;
        if (verificationEmailsSent === 3) {
            res.status(403).json({ success: false, message: 'Verification emails limit reached.' });
            return;
        }
        ;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
    await (0, accountServices_1.incrementVerificationEmailCount)(accountID, verificationEmailsSent);
    res.json({ success: true, resData: {} });
    await (0, emailServices_1.sendVerificationEmail)(accountEmail, accountID, verificationCode);
});
