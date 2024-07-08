"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRouter = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db/db");
const generateAuthTokens_1 = require("../util/generators/generateAuthTokens");
const userValidation = __importStar(require("../util/validation/userValidation"));
const accountServices = __importStar(require("../services/accountServices"));
const passwordServices_1 = require("../services/passwordServices");
const requestValidation_1 = require("../util/validation/requestValidation");
const emailServices_1 = require("../services/emailServices");
const generatePlaceHolders_1 = require("../util/generators/generatePlaceHolders");
const generateVerificationCode_1 = require("../util/generators/generateVerificationCode");
const generateRecoveryToken_1 = require("../util/generators/generateRecoveryToken");
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
    if (!userValidation.isValidEmailString(requestData.email)) {
        res.status(400).json({ success: false, message: 'Invalid email address.' });
        return;
    }
    ;
    if (!userValidation.isValidPasswordString(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    if (!userValidation.isValidNameString(requestData.userName)) {
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
    const authToken = (0, generateAuthTokens_1.generateAuthToken)('account');
    const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)();
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
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
        failed_sign_in_attempts
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(11)});`, [authToken, requestData.email, requestData.userName, hashedPassword, Date.now(), '', verificationCode, false, 1, 0, 0]);
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
exports.accountsRouter.post('/verification/resendEmail', async (req, res) => {
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
      WHERE account_id = ?;`, [requestData.accountID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
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
    await accountServices.incrementVerificationEmailCount(requestData.accountID);
    res.json({ success: true, resData: {} });
    await (0, emailServices_1.sendVerificationEmail)(accountEmail, requestData.accountID, verificationCode);
});
exports.accountsRouter.post('/verification/verify', async (req, res) => {
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
    if (!userValidation.isValidVerificationCodeString(requestData.verificationCode)) {
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
                await accountServices.deleteAccount(requestData.accountID);
                res.status(401).json({ success: false, message: 'Incorrect Verification code. Account deleted.' });
                return;
            }
            ;
            await accountServices.incrementFailedVerificationAttempts(requestData.accountID);
            res.status(401).json({ success: false, message: 'Incorrect verification code.' });
            return;
        }
        ;
        const verificationSuccessful = await accountServices.verifyAccount(res, requestData.accountID);
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
    if (!userValidation.isValidEmailString(requestData.email)) {
        res.status(400).json({ success: false, message: 'Invalid email address.' });
        return;
    }
    ;
    if (!userValidation.isValidPasswordString(requestData.password)) {
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
        failed_sign_in_attempts
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
            failedSignInAttempts: rows[0].failed_sign_in_attempts,
        };
        if (accountDetails.failedSignInAttempts === 5) {
            res.status(403).json({ success: false, message: 'Account locked.' });
            return;
        }
        ;
        const isCorrectPassword = await (0, passwordServices_1.compareHashedPassword)(res, requestData.password, accountDetails.passwordHash);
        if (!isCorrectPassword) {
            await accountServices.incrementFailedSignInAttempts(accountDetails.accountID);
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        if (!accountDetails.isVerified) {
            res.status(403).json({ success: false, message: 'Account not verified.' });
            return;
        }
        ;
        if (accountDetails.failedSignInAttempts > 0) {
            await accountServices.resetFailedSignInAttempts(accountDetails.accountID);
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
exports.accountsRouter.post('/recovery/sendEmail', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['email'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidEmailString(requestData.email)) {
        res.status(400).json({ success: false, message: 'Invalid email address.' });
        return;
    }
    ;
    const accountID = await accountServices.findAccountIdByEmail(res, requestData.email);
    if (!accountID) {
        return;
    }
    ;
    const onRecoveryCooldown = await accountServices.checkForOngoingRecovery(res, accountID);
    if (onRecoveryCooldown) {
        res.status(403).json({ success: false, message: 'Recovery on cooldown.' });
        return;
    }
    ;
    const recoveryToken = (0, generateRecoveryToken_1.generateRecoveryToken)();
    try {
        await db_1.dbPool.execute(`INSERT INTO AccountRecovery(
        account_id,
        recovery_token,
        request_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)})`, [accountID, recoveryToken, Date.now()]);
        res.json({ success: true, resData: {} });
        await (0, emailServices_1.sendRecoveryEmail)(requestData.email, recoveryToken);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.put('/recovery/updatePassword', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['recoveryToken', 'newPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidRecoveryTokenString(requestData.recoveryToken)) {
        res.status(400).json({ success: false, message: 'Invalid recovery token.' });
        return;
    }
    ;
    if (!userValidation.isValidPasswordString(requestData.newPassword)) {
        res.status(400).json({ success: false, message: 'Invalid new password.' });
        return;
    }
    ;
    let accountID;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT account_id FROM AccountRecovery
      WHERE recovery_token = ?
      LIMIT 1;`, [requestData.recoveryToken]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found' });
            return;
        }
        ;
        accountID = rows[0].account_id;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
    const hashedPassword = await (0, passwordServices_1.getHashedPassword)(res, requestData.newPassword);
    if (hashedPassword === '') {
        return;
    }
    ;
    try {
        await db_1.dbPool.execute(`UPDATE Accounts
        SET failed_sign_in_attempts = 0, password_hash = ?
      WHERE account_id = ?`, [hashedPassword, accountID]);
        res.json({ success: true, resData: {} });
        await accountServices.removeAccountRecoveryRow(requestData.recoveryToken);
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
    if (!userValidation.isValidAuthTokenString(authToken)) {
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
