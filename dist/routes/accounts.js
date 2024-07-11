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
const bcrypt_1 = __importDefault(require("bcrypt"));
const userValidation = __importStar(require("../util/validation/userValidation"));
const generateAuthTokens_1 = require("../util/generators/generateAuthTokens");
const requestValidation_1 = require("../util/validation/requestValidation");
const emailServices_1 = require("../services/emailServices");
const generatePlaceHolders_1 = require("../util/generators/generatePlaceHolders");
const generateVerificationCode_1 = require("../util/generators/generateVerificationCode");
const generateRecoveryToken_1 = require("../util/generators/generateRecoveryToken");
const generateCancellationToken_1 = require("../util/generators/generateCancellationToken");
exports.accountsRouter = express_1.default.Router();
;
exports.accountsRouter.post('/signUp', async (req, res) => {
    ;
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
    try {
        const hashedPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const accountCreationData = {
            email: requestData.email,
            hashedPassword,
            userName: requestData.userName,
        };
        await createAccount(res, accountCreationData);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
async function createAccount(res, accountCreationData, attemptNumber = 1) {
    const { email, hashedPassword, userName } = accountCreationData;
    const authToken = (0, generateAuthTokens_1.generateAuthToken)('account');
    const verificationCode = (0, generateVerificationCode_1.generateVerificationCode)();
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const [insertData] = await connection.execute(`INSERT INTO Accounts(
        auth_token,
        email,
        user_name,
        hashed_password,
        created_on_timestamp,
        friends_id_string,
        is_verified,
        failed_sign_in_attempts
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(8)})`, [authToken, email, userName, hashedPassword, Date.now(), '', 0, 0]);
        const accountID = insertData.insertId;
        await connection.execute(`INSERT INTO AccountVerification(
        account_id,
        verification_code,
        verification_emails_sent,
        failed_verification_attempts
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)})`, [accountID, verificationCode, 1, 0]);
        connection.commit();
        res.json({ success: true, resData: { accountID } });
        await (0, emailServices_1.sendVerificationEmail)(email, accountID, verificationCode);
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (!err.errno) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
            res.status(409).json({ success: false, message: 'Email address already in use.' });
            return;
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
            return await createAccount(res, accountCreationData, ++attemptNumber);
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        if (connection) {
            connection.release();
        }
        ;
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
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        Accounts.is_verified,
        Accounts.email,
        AccountVerification.verification_code,
        AccountVerification.verification_emails_sent
      FROM Accounts
      LEFT JOIN AccountVerification ON Accounts.account_id = AccountVerification.account_id
      WHERE Accounts.account_id = ?
      LIMIT 1;`, [requestData.accountID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        ;
        const accountDetails = {
            isVerified: rows[0].is_verified,
            email: rows[0].email,
            verificationCode: rows[0].verification_code,
            verificationEmailsSent: rows[0].verification_emails_sent,
        };
        if (accountDetails.isVerified) {
            res.status(400).json({ success: false, message: 'Account already verified.' });
            return;
        }
        ;
        if (accountDetails.verificationEmailsSent === 3) {
            res.status(403).json({ success: false, message: 'Verification emails limit reached.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`UPDATE AccountVerification
      SET verification_emails_sent = verification_emails_sent + 1
      WHERE account_id = ?;`, [requestData.accountID]);
        res.json({ success: true, resData: {} });
        await (0, emailServices_1.sendVerificationEmail)(accountDetails.email, requestData.accountID, accountDetails.verificationCode);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
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
    let connection;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        Accounts.auth_token,
        Accounts.is_verified,
        AccountVerification.verification_code,
        failed_verification_attempts
      FROM Accounts
      LEFT JOIN AccountVerification ON Accounts.account_id = AccountVerification.account_id
      WHERE Accounts.account_id = ?
      LIMIT 1;`, [requestData.accountID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        ;
        const accountDetails = {
            authToken: rows[0].auth_token,
            isVerified: rows[0].is_verified,
            verificationCode: rows[0].verification_code,
            failedVerificationAttempts: rows[0].failed_verification_attempts,
        };
        if (accountDetails.isVerified) {
            res.status(400).json({ success: false, message: 'Account already verified.' });
            return;
        }
        ;
        if (requestData.verificationCode !== accountDetails.verificationCode) {
            if (accountDetails.failedVerificationAttempts === 2) {
                await db_1.dbPool.execute(`DELETE FROM Accounts
          WHERE account_id = ?;`, [requestData.accountID]);
                res.status(401).json({ success: false, message: 'Incorrect verification code. Account deleted.' });
                return;
            }
            ;
            await db_1.dbPool.execute(`UPDATE AccountVerification
        SET failed_verification_attempts = failed_verification_attempts + 1
        WHERE account_id = ?;`, [requestData.accountID]);
            res.status(401).json({ success: false, message: 'Incorrect verification code.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        await connection.execute(`UPDATE Accounts
      SET is_verified = 1
      WHERE account_id = ?;`, [requestData.accountID]);
        await connection.execute(`DELETE FROM AccountVerification
      WHERE account_id = ?;`, [requestData.accountID]);
        connection.commit();
        res.json({ success: true, resData: { authToken: accountDetails.authToken } });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            connection.rollback();
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        if (connection) {
            connection.release();
        }
        ;
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
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        account_id,
        auth_token,
        hashed_password,
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
            hashedPassword: rows[0].hashed_password,
            isVerified: rows[0].is_verified,
            failedSignInAttempts: rows[0].failed_sign_in_attempts,
        };
        if (accountDetails.authToken.startsWith('d_')) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        if (accountDetails.failedSignInAttempts === 5) {
            res.status(403).json({ success: false, message: 'Account locked.' });
            return;
        }
        ;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, accountDetails.hashedPassword);
        if (!isCorrectPassword) {
            await db_1.dbPool.execute(`UPDATE Accounts
        SET failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE account_id = ?;`, [accountDetails.accountID]);
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
            await db_1.dbPool.execute(`UPDATE Accounts
        SET failed_sign_in_attempts = 0
        WHERE account_id = ?;`, [accountDetails.accountID]);
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
exports.accountsRouter.post('/recovery/start', async (req, res) => {
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
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        Accounts.account_id,
        Accounts.is_verified,
        AccountRecovery.request_timestamp
      FROM Accounts
      LEFT JOIN AccountRecovery ON Accounts.account_id = AccountRecovery.account_id
      WHERE Accounts.email = ?
      LIMIT 1;`, [requestData.email]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const accountID = rows[0].account_id;
        const isVerified = rows[0].is_verified;
        const recoveryRequestTimestamp = rows[0].request_timestamp;
        if (!isVerified) {
            res.status(403).json({ success: false, message: 'Account not verified.' });
            return;
        }
        ;
        if (!recoveryRequestTimestamp) {
            const recoveryToken = (0, generateRecoveryToken_1.generateRecoveryToken)();
            await db_1.dbPool.execute(`INSERT INTO AccountRecovery(
          account_id,
          recovery_token,
          request_timestamp
        )
        VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)})`, [accountID, recoveryToken, Date.now()]);
            res.json({ success: true, resData: {} });
            await (0, emailServices_1.sendRecoveryEmail)(requestData.email, accountID, recoveryToken);
            return;
        }
        ;
        const recoveryCooldown = 1000 * 60 * 60 * 12;
        if (Date.now() - recoveryRequestTimestamp < recoveryCooldown) {
            res.status(403).json({ success: false, message: 'On recovery cooldown.' });
            return;
        }
        ;
        const newRecoveryToken = (0, generateRecoveryToken_1.generateRecoveryToken)();
        await db_1.dbPool.execute(`UPDATE AccountRecovery
      SET
        recovery_token = ?,
        request_timestamp = ?,
        failed_recovery_attempts = ?
      WHERE account_id = ?;`, [newRecoveryToken, Date.now(), 0, accountID]);
        res.json({ success: true, resData: {} });
        await (0, emailServices_1.sendRecoveryEmail)(requestData.email, accountID, newRecoveryToken);
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1452) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        if (err.errno === 1062) {
            res.status(403).json({ success: false, message: 'On recovery cooldown.' });
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.put('/recovery/updatePassword', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['accountID', 'recoveryToken', 'newPassword'];
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
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        recovery_id,
        recovery_token
      FROM AccountRecovery
      WHERE account_id = ?;`, [requestData.accountID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'No recovery process found for this account.' });
            return;
        }
        ;
        const recoveryID = rows[0].recovery_id;
        const recoveryToken = rows[0].recovery_token;
        if (requestData.recoveryToken !== recoveryToken) {
            res.status(401).json({ success: false, message: 'Incorrect recovery token.' });
            return;
        }
        ;
        const newHashedPassword = await bcrypt_1.default.hash(requestData.newPassword, 10);
        await db_1.dbPool.execute(`UPDATE Accounts
      SET hashed_password = ?, failed_sign_in_attempts = 0
      WHERE account_id = ?;`, [newHashedPassword, requestData.accountID]);
        await db_1.dbPool.execute(`DELETE FROM AccountRecovery
      WHERE recovery_id = ?;`, [recoveryID]);
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.delete(`/deletion/start`, async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    const requestData = req.body;
    if (!userValidation.isValidAuthTokenString(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const expectedKeys = ['password'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidPasswordString(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    let connection;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        account_id,
        email,
        hashed_password
      FROM Accounts
      WHERE auth_token = ?
      LIMIT 1;`, [authToken]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        ;
        const accountDetails = {
            accountID: rows[0].account_id,
            email: rows[0].email,
            hashedPassword: rows[0].hashed_password,
        };
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, accountDetails.hashedPassword);
        if (!isCorrectPassword) {
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const markedAuthToken = `d_${authToken}`;
        const cancellationToken = (0, generateCancellationToken_1.generateCancellationToken)();
        await connection.execute(`UPDATE Accounts
      SET auth_token = ?
      WHERE account_id = ?;`, [markedAuthToken, accountDetails.accountID]);
        await connection.execute(`INSERT INTO AccountDeletionRequests(
        account_id,
        cancellation_token,
        request_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)})`, [accountDetails.accountID, cancellationToken, Date.now()]);
        connection.commit();
        res.json({ success: true, resData: {} });
        await (0, emailServices_1.sendDeletionEmail)(accountDetails.email, accountDetails.accountID, cancellationToken);
    }
    catch (err) {
        console.log(err);
        if (connection) {
            connection.rollback();
        }
        ;
        if (err.errno === 1452) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        if (connection) {
            connection.release();
        }
        ;
    }
    ;
});
exports.accountsRouter.put('/deletion/cancel', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['cancellationToken', 'accountID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountID)) {
        res.status(400).json({ succesS: false, message: 'Invalid account ID.' });
        return;
    }
    ;
    if (!userValidation.isValidCancellationTokenString(requestData.cancellationToken)) {
        res.status(400).json({ success: false, message: 'Invalid cancellation token.' });
        return;
    }
    ;
    let connection;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        deletion_id,
        cancellation_token
      FROM AccountDeletionRequests
      WHERE account_id = ?
      LIMIT 1;`, [requestData.accountID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const deletionID = rows[0].deletion_id;
        const fetchedCancellationToken = rows[0].cancellation_token;
        if (requestData.cancellationToken !== fetchedCancellationToken) {
            res.status(401).json({ success: false, message: 'Incorrect cancellation token.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        connection.execute(`UPDATE Accounts
      SET auth_token = SUBSTRING(auth_token, 3, CHAR_LENGTH(auth_token) - 2)
      WHERE account_id = ?;`, [requestData.accountID]);
        connection.execute(`DELETE FROM AccountDeletionRequests
      WHERE deletion_id = ?;`, [deletionID]);
        connection.commit();
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            connection.rollback();
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        if (connection) {
            connection.release();
        }
        ;
    }
    ;
});
exports.accountsRouter.put('/details/changePassword', async (req, res) => {
    ;
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const authToken = authHeader.substring(7);
    const requestData = req.body;
    if (!userValidation.isValidAuthTokenString(authToken)) {
        res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
        return;
    }
    ;
    const expectedKeys = ['currentPassword', 'newPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidPasswordString(requestData.currentPassword)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    if (!userValidation.isValidPasswordString(requestData.newPassword)) {
        res.status(400).json({ success: false, message: 'Invalid new password.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        account_id,
        hashed_password
      FROM Accounts
      WHERE auth_token = ?
      LIMIT 1;`, [authToken]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const accountID = rows[0].account_id;
        const hashedPassword = rows[0].hashed_password;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.currentPassword, hashedPassword);
        if (!isCorrectPassword) {
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        const newHashedPassword = await bcrypt_1.default.hash(requestData.newPassword, 10);
        await db_1.dbPool.execute(`UPDATE Accounts
      SET hashed_password = ?
      WHERE account_id = ?;`, [newHashedPassword, accountID]);
        res.json({ success: true, resData: {} });
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
        const accountName = rows[0].user_name;
        const friendsIdString = rows[0].friends_id_string;
        res.json({ success: true, resData: { accountName, friendsIdString } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
