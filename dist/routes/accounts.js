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
    const authToken = (0, authTokens_1.generateAuthToken)('account');
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
        friends_id_string,
        verification_code,
        is_verified,
        verification_emails_sent,
        failed_verification_attempts,
        failed_signin_attempts,
        recovery_email_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(12)});`, [authToken, requestData.email, requestData.userName, hashedPassword, Date.now(), '', verificationCode, false, 1, 0, 0, 0]);
        const accountID = insertData.insertId;
        res.json({ success: true, resData: { accountID } });
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
exports.accountsRouter.post('/resendVerificationCode', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['accountID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountID)) {
        res.status(400).json({ success: false, message: 'Invalid account ID.' });
        return;
    }
    ;
    let accountEmail;
    let verificationCode;
    let verificationEmailsSent;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        email,
        verification_code,
        verification_emails_sent
      FROM Accounts
      WHERE account_id = ?
      LIMIT 1;`, [requestData.accountID]);
        if (rows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
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
    await (0, accountServices_1.incrementVerificationEmailCount)(requestData.accountID);
    res.json({ success: true, resData: {} });
    await (0, emailServices_1.sendVerificationEmail)(accountEmail, requestData.accountID, verificationCode);
});
exports.accountsRouter.post('/verifyAccount', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['accountID', 'verificationCode'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountID)) {
        res.status(400).json({ success: false, message: 'Invalid account ID.' });
        return;
    }
    ;
    if (!(0, userValidation_1.isValidVerificationCode)(requestData.verificationCode)) {
        res.status(400).json({ success: false, message: 'Invalid verification code.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        auth_token,
        verification_code,
        is_verified,
        failed_verification_attempts
      FROM Accounts
      WHERE account_id = ?;`, [requestData.accountID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        ;
        const accountDetails = {
            authToken: rows[0].auth_token,
            verificationCode: rows[0].verification_code,
            isVerified: rows[0].is_verified,
            failedVerificationAttempts: rows[0].failed_verification_attempts,
        };
        if (accountDetails.isVerified) {
            res.status(400).json({ success: false, message: 'Account already verified.' });
            return;
        }
        ;
        if (requestData.verificationCode !== accountDetails.verificationCode) {
            if (accountDetails.failedVerificationAttempts === 2) {
                await (0, accountServices_1.deleteAccount)(requestData.accountID);
                res.status(401).json({ success: false, message: 'Incorrect Verification code. Account deleted.' });
                return;
            }
            ;
            await (0, accountServices_1.incrementFailedVerificationAttempts)(requestData.accountID);
            res.status(401).json({ success: false, message: 'Incorrect verification code.' });
            return;
        }
        ;
        const verificationSuccessful = await (0, accountServices_1.verifyAccount)(res, requestData.accountID);
        if (!verificationSuccessful) {
            return;
        }
        ;
        res.json({ success: true, resData: { authToken: accountDetails.authToken } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
});
exports.accountsRouter.post('/signIn', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['email', 'password'];
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
        res.status(401).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        account_id,
        auth_token,
        password_hash,
        is_verified,
        failed_signin_attempts
      FROM Accounts
      WHERE email = ?
      LIMIT 1;`, [requestData.email]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        ;
        const accountDetails = {
            accountID: rows[0].account_id,
            authToken: rows[0].auth_token,
            passwordHash: rows[0].password_hash,
            isVerified: rows[0].is_verified,
            failedSigningAttempts: rows[0].failed_signin_attempts,
        };
        if (accountDetails.failedSigningAttempts === 5) {
            res.status(403).json({ success: false, message: 'Account locked.' });
            return;
        }
        ;
        const isCorrectPassword = await (0, passwordServices_1.compareHashedPassword)(res, requestData.password, accountDetails.passwordHash);
        if (!isCorrectPassword) {
            await (0, accountServices_1.incrementFailedSignInAttempts)(accountDetails.accountID);
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        if (!accountDetails.isVerified) {
            res.status(403).json({ success: false, message: 'Account not verified.' });
            return;
        }
        ;
        res.json({ success: true, resData: { authToken: accountDetails.authToken } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.get('/', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    if (!(0, userValidation_1.isValidAuthTokenString)(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        user_name,
        friends_id_string
      FROM Accounts
      WHERE auth_token = ?
      LIMIT 1;`, [authToken]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const accountDetails = {
            accountName: rows[0].user_name,
            friendsIdString: rows[0].friends_id_string,
        };
        res.json({ success: true, resData: accountDetails });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
