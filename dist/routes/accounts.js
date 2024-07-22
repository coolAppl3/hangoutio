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
const tokenGenerator = __importStar(require("../util/tokenGenerator"));
const requestValidation_1 = require("../util/validation/requestValidation");
const emailServices_1 = require("../util/email/emailServices");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
exports.accountsRouter = express_1.default.Router();
;
;
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
    if (!userValidation.isValidNewPasswordString(requestData.password)) {
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
    const authToken = tokenGenerator.generateAuthToken('account');
    const verificationCode = tokenGenerator.generateUniqueCode();
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.execute(`SELECT new_email from EmailUpdateRequests
      WHERE new_email = ?`, [accountCreationData.email]);
        if (rows.length !== 0) {
            res.status(409).json({ success: false, message: 'Email address already in use.' });
            return;
        }
        ;
        const [insertData] = await connection.execute(`INSERT INTO Accounts(
        auth_token,
        email,
        user_name,
        hashed_password,
        created_on_timestamp,
        friends_id_string,
        is_verified,
        failed_sign_in_attempts,
        marked_for_deletion
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(9)})`, [authToken, email, userName, hashedPassword, Date.now(), '', false, 0, false]);
        const accountID = insertData.insertId;
        await connection.execute(`INSERT INTO AccountVerification(
        account_id,
        verification_code,
        verification_emails_sent,
        failed_verification_attempts
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)})`, [accountID, verificationCode, 1, 0]);
        await connection.commit();
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
    if (!userValidation.isValidCodeString(requestData.verificationCode)) {
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
        SET is_verified = TRUE
      WHERE account_id = ?;`, [requestData.accountID]);
        await connection.execute(`DELETE FROM AccountVerification
      WHERE account_id = ?;`, [requestData.accountID]);
        await connection.commit();
        res.json({ success: true, resData: { authToken: accountDetails.authToken } });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
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
        failed_sign_in_attempts,
        marked_for_deletion
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
            markedForDeletion: rows[0].marked_for_deletion,
        };
        if (accountDetails.markedForDeletion) {
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
            if (accountDetails.failedSignInAttempts + 1 === 5) {
                res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
                return;
            }
            ;
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
        Accounts.marked_for_deletion,
        AccountRecovery.recovery_id,
        AccountRecovery.recovery_emails_sent,
        AccountRecovery.recovery_token
      FROM Accounts
      LEFT JOIN AccountRecovery ON Accounts.account_id = AccountRecovery.account_id
      WHERE Accounts.email = ?
      LIMIT 1;`, [requestData.email]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        ;
        const accountDetails = {
            accountID: rows[0].account_id,
            isVerified: rows[0].is_verified,
            markedForDeletion: rows[0].markedForDeletion,
            recoveryID: rows[0].recovery_id,
            recoveryEmailsSent: rows[0].recovery_emails_sent,
            recoveryToken: rows[0].recovery_token,
        };
        if (accountDetails.markedForDeletion) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        if (!accountDetails.isVerified) {
            res.status(403).json({ success: false, message: 'Account not verified.' });
            return;
        }
        ;
        if (!accountDetails.recoveryID) {
            const newRecoveryToken = tokenGenerator.generateUniqueToken();
            await db_1.dbPool.execute(`INSERT INTO AccountRecovery(
          account_id,
          recovery_token,
          request_timestamp,
          recovery_emails_sent
        )
        VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)})`, [accountDetails.accountID, newRecoveryToken, Date.now(), 1]);
            res.json({ success: true, resData: {} });
            await (0, emailServices_1.sendRecoveryEmail)(requestData.email, accountDetails.accountID, newRecoveryToken);
            return;
        }
        ;
        if (accountDetails.recoveryEmailsSent === 3) {
            res.status(403).json({ success: false, message: 'Recovery email limit reached.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`UPDATE AccountRecovery
        SET recovery_emails_sent = recovery_emails_sent + 1
      WHERE account_id = ?;`, [accountDetails.recoveryID]);
        res.json({ success: true, resData: {} });
        await (0, emailServices_1.sendRecoveryEmail)(requestData.email, accountDetails.accountID, accountDetails.recoveryToken);
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1452) {
            res.status(404).json({ success: false, message: 'Account not found.' });
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
    if (!userValidation.isValidToken(requestData.recoveryToken)) {
        res.status(400).json({ success: false, message: 'Invalid recovery token.' });
        return;
    }
    ;
    if (!userValidation.isValidNewPasswordString(requestData.newPassword)) {
        res.status(400).json({ success: false, message: 'Invalid new password.' });
        return;
    }
    ;
    let connection;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        recovery_id,
        recovery_token
      FROM AccountRecovery
      WHERE account_id = ?;`, [requestData.accountID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Recovery request not found.' });
            return;
        }
        ;
        ;
        const accountDetails = {
            recoveryID: rows[0].recovery_id,
            recoveryToken: rows[0].recovery_token,
        };
        if (requestData.recoveryToken !== accountDetails.recoveryToken) {
            res.status(401).json({ success: false, message: 'Incorrect recovery token.' });
            return;
        }
        ;
        const newHashedPassword = await bcrypt_1.default.hash(requestData.newPassword, 10);
        const updatePasswordData = {
            accountID: requestData.accountID,
            recoveryID: accountDetails.recoveryID,
            newHashedPassword,
        };
        await updatePassword(res, updatePasswordData);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
async function updatePassword(res, updatePasswordData, attemptNumber = 1) {
    const newAuthToken = tokenGenerator.generateAuthToken('account');
    let connection;
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        await connection.execute(`UPDATE Accounts
        SET
        auth_token = ?,
        hashed_password = ?,
        failed_sign_in_attempts = 0
      WHERE account_id = ?;`, [newAuthToken, updatePasswordData.newHashedPassword, updatePasswordData.accountID]);
        await connection.execute(`DELETE FROM AccountRecovery
      WHERE recovery_id = ?;`, [updatePasswordData.recoveryID]);
        await connection.commit();
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
            return await updatePassword(res, updatePasswordData, ++attemptNumber);
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
        hashed_password,
        failed_sign_in_attempts
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
            failedSignInAttempts: rows[0].failed_sign_in_attempts
        };
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
            if (accountDetails.failedSignInAttempts + 1 === 5) {
                res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
                return;
            }
            ;
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const markedAuthToken = `d_${authToken}`;
        const cancellationToken = tokenGenerator.generateUniqueToken();
        await connection.execute(`UPDATE Accounts
        SET
        auth_token = ?,
        marked_for_deletion = TRUE
      WHERE account_id = ?;`, [markedAuthToken, accountDetails.accountID]);
        await connection.execute(`INSERT INTO AccountDeletionRequests(
        account_id,
        cancellation_token,
        request_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [accountDetails.accountID, cancellationToken, Date.now()]);
        await connection.commit();
        res.status(202).json({ success: true, resData: {} });
        await (0, emailServices_1.sendDeletionEmail)(accountDetails.email, accountDetails.accountID, cancellationToken);
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
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
    if (!userValidation.isValidToken(requestData.cancellationToken)) {
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
            res.status(404).json({ success: false, message: 'Deletion request not found.' });
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
        SET
        auth_token = SUBSTRING(auth_token, 3, CHAR_LENGTH(auth_token) - 2),
        marked_for_deletion = FALSE
      WHERE account_id = ?;`, [requestData.accountID]);
        connection.execute(`DELETE FROM AccountDeletionRequests
      WHERE deletion_id = ?;`, [deletionID]);
        await connection.commit();
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
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
exports.accountsRouter.put('/details/updatePassword', async (req, res) => {
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
    if (!userValidation.isValidNewPasswordString(requestData.newPassword)) {
        res.status(400).json({ success: false, message: 'Invalid new password.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        account_id,
        hashed_password,
        failed_sign_in_attempts
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
            hashedPassword: rows[0].hashed_password,
            failedSignInAttempts: rows[0].failed_sign_in_attempts,
        };
        if (accountDetails.failedSignInAttempts === 5) {
            res.status(403).json({ success: false, message: 'Account locked.' });
            return;
        }
        ;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.currentPassword, accountDetails.hashedPassword);
        if (!isCorrectPassword) {
            await db_1.dbPool.execute(`UPDATE Accounts
          SET failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE account_id = ?;`, [accountDetails.accountID]);
            if (accountDetails.failedSignInAttempts + 1 === 5) {
                res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
                return;
            }
            ;
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        const newHashedPassword = await bcrypt_1.default.hash(requestData.newPassword, 10);
        await db_1.dbPool.execute(`UPDATE Accounts
        SET hashed_password = ?
      WHERE account_id = ?;`, [newHashedPassword, accountDetails.accountID]);
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.post('/details/updateEmail/start', async (req, res) => {
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
    const expectedKeys = ['password', 'newEmail'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidEmailString(requestData.newEmail)) {
        res.status(400).json({ success: false, message: 'Invalid new email address.' });
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
        Accounts.account_id,
        Accounts.hashed_password,
        Accounts.email,
        Accounts.failed_sign_in_attempts,
        EmailUpdateRequests.update_id,
        EmailUpdateRequests.new_email,
        EmailUpdateRequests.verification_code,
        EmailUpdateRequests.update_emails_sent
      FROM Accounts
      LEFT JOIN EmailUpdateRequests ON Accounts.account_id = EmailUpdateRequests.account_id
      WHERE Accounts.auth_token = ?
      LIMIT 1;`, [authToken]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        ;
        const accountDetails = {
            accountID: rows[0].account_id,
            hashedPassword: rows[0].hashed_password,
            currentEmail: rows[0].email,
            failedSignInAttempts: rows[0].failed_sign_in_attempts,
            updateID: rows[0].update_id,
            newEmail: rows[0].new_email,
            verificationCode: rows[0].verification_code,
            updateEmailsSent: rows[0].update_emails_sent,
        };
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
            if (accountDetails.failedSignInAttempts + 1 === 5) {
                res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
                return;
            }
            ;
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        if (requestData.newEmail === accountDetails.currentEmail) {
            res.status(403).json({ success: false, message: 'New email can not be equal to the current email.' });
            return;
        }
        ;
        if (!accountDetails.updateID) {
            const newVerificationCode = tokenGenerator.generateUniqueCode();
            await db_1.dbPool.execute(`INSERT INTO EmailUpdateRequests(
          account_id,
          new_email,
          verification_code,
          request_timestamp,
          update_emails_sent,
          failed_update_attempts
        )
        VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(6)})`, [accountDetails.accountID, requestData.newEmail, newVerificationCode, Date.now(), 1, 0]);
            res.json({ success: true, resData: { accountID: accountDetails.accountID } });
            await (0, emailServices_1.sendEmailUpdateEmail)(requestData.newEmail, accountDetails.accountID, newVerificationCode);
            return;
        }
        ;
        if (requestData.newEmail !== accountDetails.newEmail) {
            res.status(403).json({ success: false, message: 'Ongoing request contains a different new email address.' });
            return;
        }
        ;
        if (accountDetails.updateEmailsSent === 3) {
            res.status(403).json({ success: false, message: 'Update email limit reached.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`UPDATE EmailUpdateRequests
        SET update_emails_sent = update_emails_sent + 1
      WHERE update_id = ?;`, [accountDetails.updateID]);
        res.json({ success: true, resData: { accountID: accountDetails.accountID } });
        await (0, emailServices_1.sendEmailUpdateEmail)(accountDetails.newEmail, accountDetails.accountID, accountDetails.verificationCode);
    }
    catch (err) {
        console.log(err);
        if (err.errno === 1452) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.put('/details/updateEmail/confirm', async (req, res) => {
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
    if (!userValidation.isValidCodeString(requestData.verificationCode)) {
        res.status(400).json({ success: false, message: 'Invalid verification code.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        Accounts.auth_token,
        EmailUpdateRequests.update_id,
        EmailUpdateRequests.new_email,
        EmailUpdateRequests.verification_code,
        EmailUpdateRequests.failed_update_attempts
      FROM Accounts
      LEFT JOIN EmailUpdateRequests ON Accounts.account_id = EmailUpdateRequests.account_id
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
            updateID: rows[0].update_id,
            newEmail: rows[0].new_email,
            verificationCode: rows[0].verification_code,
            failedUpdateAttempts: rows[0].failed_update_attempts,
        };
        if (authToken !== accountDetails.authToken) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        if (!accountDetails.updateID) {
            res.status(404).json({ success: false, message: 'Email update request not found.' });
            return;
        }
        ;
        if (accountDetails.failedUpdateAttempts === 3) {
            res.status(403).json({ success: false, message: 'Update attempt limit reached.' });
            return;
        }
        ;
        if (requestData.verificationCode !== accountDetails.verificationCode) {
            await db_1.dbPool.execute(`UPDATE EmailUpdateRequests
          SET failed_update_attempts = failed_update_attempts + 1
        WHERE update_id = ?`, [accountDetails.updateID]);
            if (accountDetails.failedUpdateAttempts + 1 === 3) {
                res.status(401).json({ success: false, message: 'Incorrect verification code. Request suspended.' });
                return;
            }
            ;
            res.status(401).json({ success: false, message: 'Incorrect verification code.' });
            return;
        }
        ;
        const updateEmailData = {
            accountID: requestData.accountID,
            updateID: accountDetails.updateID,
            newEmail: accountDetails.newEmail,
        };
        await updateEmail(res, updateEmailData);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
async function updateEmail(res, emailUpdateData, attemptNumber = 1) {
    const newAuthToken = tokenGenerator.generateAuthToken('account');
    let connection;
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        await connection.execute(`UPDATE Accounts
        SET
        auth_token = ?,
        email = ?
      WHERE account_id = ?;`, [newAuthToken, emailUpdateData.newEmail, emailUpdateData.accountID]);
        await connection.execute(`DELETE FROM EmailUpdateRequests
      WHERE update_id = ?;`, [emailUpdateData.updateID]);
        connection.commit();
        res.json({ success: true, resData: { newAuthToken } });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'email'`)) {
            res.status(409).json({ success: false, message: 'Email address already in use.' });
            return;
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
            return await updateEmail(res, emailUpdateData, ++attemptNumber);
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
exports.accountsRouter.put('/details/updateName', async (req, res) => {
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
    const expectedKeys = ['password', 'newName'];
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
    if (!userValidation.isValidNameString(requestData.newName)) {
        res.status(400).json({ success: false, message: 'Invalid account name.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        account_id,
        hashed_password,
        failed_sign_in_attempts
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
            hashedPassword: rows[0].hashed_password,
            failedSignInAttempts: rows[0].failed_sign_in_attempts,
        };
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
            if (accountDetails.failedSignInAttempts + 1 === 5) {
                res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
                return;
            }
            ;
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`UPDATE Accounts
        SET user_name = ?
      WHERE account_id = ?;`, [requestData.newName, accountDetails.accountID]);
        res.json({ success: true, resData: { newName: requestData.newName } });
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
        ;
        const accountDetails = {
            accountName: rows[0].user_name,
            friendsIdString: rows[0].friends_id_string,
        };
        res.json({ success: true, resData: { accountName: accountDetails.accountName, friendsIdString: accountDetails.friendsIdString } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
