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
async function createAccount(res, createAccountData, attemptNumber = 1) {
    const { email, hashedPassword, displayName, username } = createAccountData;
    const authToken = tokenGenerator.generateAuthToken('account');
    const verificationCode = tokenGenerator.generateUniqueCode();
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
    let connection;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        new_email
      FROM
        EmailUpdateRequests
      WHERE
        new_email = ?;`, [createAccountData.email]);
        if (rows.length !== 0) {
            res.status(409).json({ success: false, message: 'Email address already in use.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const [insertData] = await connection.execute(`INSERT INTO Accounts(
        auth_token,
        email,
        hashed_password,
        username,
        display_name,
        created_on_timestamp,
        is_verified,
        failed_sign_in_attempts,
        marked_for_deletion
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(9)});`, [authToken, email, hashedPassword, username, displayName, Date.now(), false, 0, false]);
        const accountID = insertData.insertId;
        await connection.execute(`INSERT INTO AccountVerification(
        account_id,
        verification_code,
        verification_emails_sent,
        failed_verification_attempts
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)});`, [accountID, verificationCode, 1, 0]);
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
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'username'`)) {
            res.status(409).json({ success: false, message: 'Username taken.' });
            return;
        }
        ;
        if (err.errno === 1062 && err.sqlMessage.endsWith(`for key 'auth_token'`)) {
            return await createAccount(res, createAccountData, ++attemptNumber);
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
;
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
        await connection.execute(`UPDATE
        Accounts
      SET
        auth_token = ?,
        hashed_password = ?,
        failed_sign_in_attempts = 0
      WHERE
        account_id = ?;`, [newAuthToken, updatePasswordData.newHashedPassword, updatePasswordData.accountID]);
        if (updatePasswordData.recoveryID) {
            await connection.execute(`DELETE FROM
          AccountRecovery
        WHERE
          recovery_id = ?;`, [updatePasswordData.recoveryID]);
        }
        ;
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
;
async function updateEmail(res, emailUpdateData, attemptNumber = 1) {
    const newAuthToken = tokenGenerator.generateAuthToken('account');
    if (attemptNumber > 3) {
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return;
    }
    ;
    try {
        await db_1.dbPool.execute(`UPDATE
        Accounts
      SET
        auth_token = ?,
        email = ?
      WHERE
        account_id = ?;`, [newAuthToken, emailUpdateData.newEmail, emailUpdateData.accountID]);
        await db_1.dbPool.execute(`DELETE FROM
        EmailUpdateRequests
      WHERE
        update_id = ?;`, [emailUpdateData.updateID]);
        res.json({ success: true, resData: { newAuthToken } });
    }
    catch (err) {
        console.log(err);
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
    ;
}
;
exports.accountsRouter.post('/signUp', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['email', 'password', 'username', 'displayName'];
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
    if (!userValidation.isValidUsernameString(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid username.' });
        return;
    }
    ;
    if (!userValidation.isValidDisplayNameString(requestData.displayName)) {
        res.status(400).json({ success: false, message: 'Invalid display name.' });
        return;
    }
    ;
    try {
        const hashedPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const createAccountData = {
            email: requestData.email,
            hashedPassword,
            username: requestData.username,
            displayName: requestData.displayName,
        };
        await createAccount(res, createAccountData);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
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
      FROM
        Accounts
      LEFT JOIN
        AccountVerification ON Accounts.account_id = AccountVerification.account_id
      WHERE
        Accounts.account_id = ?
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
        await db_1.dbPool.execute(`UPDATE
        AccountVerification
      SET
        verification_emails_sent = verification_emails_sent + 1
      WHERE
        account_id = ?;`, [requestData.accountID]);
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
      FROM
        Accounts
      LEFT JOIN
        AccountVerification ON Accounts.account_id = AccountVerification.account_id
      WHERE
        Accounts.account_id = ?
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
                await db_1.dbPool.execute(`DELETE FROM
            Accounts
          WHERE
            account_id = ?;`, [requestData.accountID]);
                res.status(401).json({ success: false, message: 'Incorrect verification code. Account deleted.' });
                return;
            }
            ;
            await db_1.dbPool.execute(`UPDATE
          AccountVerification
        SET
          failed_verification_attempts = failed_verification_attempts + 1
        WHERE
          account_id = ?;`, [requestData.accountID]);
            res.status(401).json({ success: false, message: 'Incorrect verification code.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        await connection.execute(`UPDATE
        Accounts
      SET
        is_verified = TRUE
      WHERE
        account_id = ?;`, [requestData.accountID]);
        await connection.execute(`DELETE FROM
        AccountVerification
      WHERE
        account_id = ?;`, [requestData.accountID]);
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
    const expectedKeys = ['username', 'password'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidUsernameString(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid username.' });
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
      FROM
        Accounts
      WHERE
        username = ?
      LIMIT 1;`, [requestData.username]);
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
            await db_1.dbPool.execute(`UPDATE
          Accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`, [accountDetails.accountID]);
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
            await db_1.dbPool.execute(`UPDATE
          Accounts
        SET
          failed_sign_in_attempts = 0
        WHERE
          account_id = ?;`, [accountDetails.accountID]);
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
      FROM
        Accounts
      LEFT JOIN
        AccountRecovery ON Accounts.account_id = AccountRecovery.account_id
      WHERE
        Accounts.email = ?
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
        VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)});`, [accountDetails.accountID, newRecoveryToken, Date.now(), 1]);
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
        await db_1.dbPool.execute(`UPDATE
        AccountRecovery
      SET
        recovery_emails_sent = recovery_emails_sent + 1
      WHERE
        recovery_id = ?;`, [accountDetails.recoveryID]);
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
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        recovery_id,
        recovery_token
      FROM
        AccountRecovery
      WHERE
        account_id = ?;`, [requestData.accountID]);
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
      FROM
        Accounts
      WHERE
        auth_token = ?
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
            await db_1.dbPool.execute(`UPDATE
          Accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`, [accountDetails.accountID]);
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
        const [hangoutRows] = await connection.execute(`SELECT
        hangout_id
      FROM
        HangoutMembers
      WHERE
        auth_token = ? AND
        is_leader = TRUE;`, [authToken]);
        if (hangoutRows.length !== 0) {
            let hangoutIdsToDelete = ``;
            for (let i = 0; i < hangoutRows.length; i++) {
                if (i + 1 === hangoutRows.length) {
                    hangoutIdsToDelete += `'${hangoutRows[i].hangout_id}'`;
                    continue;
                }
                ;
                hangoutIdsToDelete += `'${hangoutRows[i].hangout_id}', `;
            }
            ;
            console.log(hangoutRows);
            console.log(hangoutIdsToDelete);
            await connection.execute(`DELETE FROM
          Hangouts
        WHERE
          hangout_id IN (${hangoutIdsToDelete});`);
            await connection.execute(`DELETE FROM
          HangoutMembers
        WHERE
          auth_token = ?;`, [authToken]);
        }
        ;
        const markedAuthToken = `d_${authToken}`;
        const cancellationToken = tokenGenerator.generateUniqueToken();
        await connection.execute(`UPDATE
        Accounts
      SET
        auth_token = ?,
        marked_for_deletion = TRUE
      WHERE
        account_id = ?;`, [markedAuthToken, accountDetails.accountID]);
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
      FROM
        AccountDeletionRequests
      WHERE
        account_id = ?
      LIMIT 1;`, [requestData.accountID]);
        if (rows.length === 0) {
            res.status(404).json({ success: false, message: 'Deletion request not found.' });
            return;
        }
        ;
        ;
        const deletionData = {
            deletionID: rows[0].deletion_id,
            cancellationToken: rows[0].cancellation_token,
        };
        if (requestData.cancellationToken !== deletionData.cancellationToken) {
            res.status(401).json({ success: false, message: 'Incorrect cancellation token.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        connection.execute(`UPDATE
        Accounts
      SET
        auth_token = SUBSTRING(auth_token, 3, CHAR_LENGTH(auth_token) - 2),
        marked_for_deletion = FALSE
      WHERE
        account_id = ?;`, [requestData.accountID]);
        connection.execute(`DELETE FROM
        AccountDeletionRequests
      WHERE
        deletion_id = ?;`, [deletionData.deletionID]);
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
      FROM
        Accounts
      WHERE
        auth_token = ?
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
            await db_1.dbPool.execute(`UPDATE
          Accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`, [accountDetails.accountID]);
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
        const updatePasswordData = {
            accountID: accountDetails.accountID,
            recoveryID: null,
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
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const [rows] = await connection.execute(`SELECT
        Accounts.account_id,
        Accounts.hashed_password,
        Accounts.email,
        Accounts.failed_sign_in_attempts,
        EmailUpdateRequests.update_id,
        EmailUpdateRequests.new_email,
        EmailUpdateRequests.verification_code,
        EmailUpdateRequests.update_emails_sent
      FROM
        Accounts
      LEFT JOIN
        EmailUpdateRequests ON Accounts.account_id = EmailUpdateRequests.account_id
      WHERE
        Accounts.auth_token = ?
      LIMIT 1;`, [authToken]);
        if (rows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
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
            await connection.execute(`UPDATE
          Accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`, [accountDetails.accountID]);
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
            res.status(409).json({ success: false, message: 'New email can not be equal to the current email.' });
            return;
        }
        ;
        const [emailRows] = await connection.execute(`SELECT
        1
      FROM
        Accounts
      WHERE
        email = ?
      UNION
      SELECT
        1
      FROM
        EmailUpdateRequests
      WHERE
        new_email = ?
      LIMIT 1;`, [requestData.newEmail, requestData.newEmail]);
        if (emailRows.length !== 0) {
            res.status(409).json({ success: false, message: 'Email already in use.' });
            return;
        }
        ;
        if (!accountDetails.updateID) {
            const newVerificationCode = tokenGenerator.generateUniqueCode();
            await connection.execute(`INSERT INTO EmailUpdateRequests(
          account_id,
          new_email,
          verification_code,
          request_timestamp,
          update_emails_sent,
          failed_update_attempts
        )
        VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [accountDetails.accountID, requestData.newEmail, newVerificationCode, Date.now(), 1, 0]);
            await connection.commit();
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
        await connection.execute(`UPDATE
        EmailUpdateRequests
      SET
        update_emails_sent = update_emails_sent + 1
      WHERE
        update_id = ?;`, [accountDetails.updateID]);
        await connection.commit();
        res.json({ success: true, resData: { accountID: accountDetails.accountID } });
        await (0, emailServices_1.sendEmailUpdateEmail)(accountDetails.newEmail, accountDetails.accountID, accountDetails.verificationCode);
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (err.errno === 1062) {
            res.status(409).json({ success: false, message: 'Email already in use.' });
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
      FROM
        Accounts
      LEFT JOIN
        EmailUpdateRequests ON Accounts.account_id = EmailUpdateRequests.account_id
      WHERE
        Accounts.account_id = ?
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
            await db_1.dbPool.execute(`UPDATE
          EmailUpdateRequests
        SET
          failed_update_attempts = failed_update_attempts + 1
        WHERE
          update_id = ?;`, [accountDetails.updateID]);
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
exports.accountsRouter.put('/details/updateDisplayName', async (req, res) => {
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
    const expectedKeys = ['password', 'newDisplayName'];
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
    if (!userValidation.isValidDisplayNameString(requestData.newDisplayName)) {
        res.status(400).json({ success: false, message: 'Invalid display name.' });
        return;
    }
    ;
    try {
        const [rows] = await db_1.dbPool.execute(`SELECT
        account_id,
        hashed_password,
        failed_sign_in_attempts,
        display_name
      FROM
        Accounts
      WHERE
        auth_token = ?
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
            displayName: rows[0].display_name,
        };
        if (accountDetails.failedSignInAttempts === 5) {
            res.status(403).json({ success: false, message: 'Account locked.' });
            return;
        }
        ;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, accountDetails.hashedPassword);
        if (!isCorrectPassword) {
            await db_1.dbPool.execute(`UPDATE
          Accounts
        SET
          failed_sign_in_attempts = failed_sign_in_attempts + 1
        WHERE
          account_id = ?;`, [accountDetails.accountID]);
            if (accountDetails.failedSignInAttempts + 1 === 5) {
                res.status(401).json({ success: false, message: 'Incorrect password. Account locked.' });
                return;
            }
            ;
            res.status(401).json({ success: false, message: 'Incorrect password.' });
            return;
        }
        ;
        if (requestData.newDisplayName === accountDetails.displayName) {
            res.status(409).json({ success: false, message: 'Account already has this display name.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`UPDATE
        Accounts
      SET
        display_name = ?
      WHERE
        account_id = ?;`, [requestData.newDisplayName, accountDetails.accountID]);
        res.json({ success: true, resData: { newDisplayName: requestData.newDisplayName } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.post('/friends/requests/send', async (req, res) => {
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
    const expectedKeys = ['requesteeUsername'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidUsernameString(requestData.requesteeUsername)) {
        res.status(400).json({ success: false, message: 'Invalid username.' });
        return;
    }
    ;
    try {
        const [requesterRows] = await db_1.dbPool.execute(`SELECT
        account_id,
        username
      FROM
        Accounts
      WHERE
        auth_token = ?;`, [authToken]);
        if (requesterRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const requesterID = requesterRows[0].account_id;
        const requesterUsername = requesterRows[0].username;
        if (requesterUsername === requestData.requesteeUsername) {
            res.status(409).json({ success: false, message: 'Can not add yourself as a friend.' });
            return;
        }
        ;
        const [requesteeRows] = await db_1.dbPool.execute(`SELECT
        account_id
      FROM
        Accounts
      WHERE
        username = ?
      LIMIT 1;`, [requestData.requesteeUsername]);
        if (requesteeRows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const requesteeID = requesteeRows[0].account_id;
        const [friendshipRows] = await db_1.dbPool.execute(`SELECT
        friendship_id
      FROM
        Friendships
      WHERE
        account_id = ? AND
        friend_id = ?
      LIMIT 1;`, [requesterID, requesteeID]);
        if (friendshipRows.length > 0) {
            res.status(409).json({ success: false, message: 'Already friends.' });
            return;
        }
        ;
        const [friendRequestRows] = await db_1.dbPool.execute(`SELECT
        request_id,
        requester_id,
        requestee_id
      FROM
        FriendRequests
      WHERE
        (requester_id = ? AND requestee_id = ?) OR
        (requester_id = ? AND requestee_id = ?)
      LIMIT 2;`, [requesterID, requesteeID, requesteeID, requesterID]);
        if (friendRequestRows.length === 0) {
            await db_1.dbPool.execute(`INSERT INTO FriendRequests(
          requester_id,
          requestee_id,
          request_timestamp
        )
        VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [requesterID, requesteeID, Date.now()]);
            res.json({ success: true, resData: {} });
            return;
        }
        ;
        let toRequester = false;
        let toRequestee = false;
        for (const request of friendRequestRows) {
            if (request.requester_id === requesterID) {
                toRequestee = true;
            }
            ;
            if (request.requester_id === requesteeID) {
                toRequester = true;
            }
            ;
        }
        ;
        if (!toRequester && toRequestee) {
            res.status(409).json({ success: false, message: 'Request already sent.' });
            return;
        }
        ;
        const request = friendRequestRows.find((request) => request.requester_id === requesteeID);
        res.status(409).json({
            success: false,
            message: 'Pending friend request.',
            resData: {
                friendRequestID: request.request_id,
            },
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.put('/friends/requests/accept', async (req, res) => {
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
    const expectedKeys = ['friendRequestID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.friendRequestID)) {
        res.status(400).json({ success: false, message: 'Invalid friend request ID.' });
        return;
    }
    ;
    let connection;
    try {
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        account_id
      FROM
        Accounts
      WHERE
        auth_token = ?;`, [authToken]);
        if (accountRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const accountID = accountRows[0].account_id;
        const [friendRequestRows] = await db_1.dbPool.execute(`SELECT
        requester_id
      FROM
        FriendRequests
      WHERE
        request_id = ? AND
        requestee_id = ?;`, [requestData.friendRequestID, accountID]);
        if (friendRequestRows.length === 0) {
            res.status(404).json({ success: false, message: 'Friend request not found.' });
            return;
        }
        ;
        const friendID = friendRequestRows[0].requester_id;
        const friendshipTimestamp = Date.now();
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        connection.execute(`INSERT INTO Friendships(
        account_id,
        friend_id,
        friendship_timestamp
      )
      VALUES
        (${(0, generatePlaceHolders_1.generatePlaceHolders)(3)}),
        (${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [accountID, friendID, friendshipTimestamp, friendID, accountID, friendshipTimestamp]);
        connection.execute(`DELETE FROM
        FriendRequests
      WHERE
        requester_id = ? AND
        requestee_id = ?;`, [friendID, accountID]);
        await connection.commit();
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        if (connection) {
            await connection.rollback();
        }
        ;
        if (err.errno === 1062) {
            res.status(409).json({ success: false, message: 'Already friends.' });
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
exports.accountsRouter.delete('/friends/requests/decline', async (req, res) => {
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
    const expectedKeys = ['friendRequestID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.friendRequestID)) {
        res.status(400).json({ success: false, message: 'Invalid friend request ID.' });
    }
    ;
    try {
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        account_id
      FROM
        Accounts
      WHERE
        auth_token = ?;`, [authToken]);
        if (accountRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const accountID = accountRows[0].account_id;
        const [deletionData] = await db_1.dbPool.execute(`DELETE FROM
        FriendRequests
      WHERE
        request_id = ? AND
        requestee_id = ?;`, [requestData.friendRequestID, accountID]);
        if (deletionData.affectedRows === 0) {
            res.status(404).json({ success: false, message: 'Friend request not found.' });
            return;
        }
        ;
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.delete('/friends/remove', async (req, res) => {
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
    const expectedKeys = ['friendRequestID'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.friendshipID)) {
        res.status(400).json({ success: false, message: 'Invalid friendship ID.' });
        return;
    }
    ;
    try {
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        account_id
      FROM
        Accounts
      WHERE
        auth_token = ?;`, [authToken]);
        if (accountRows.length === 0) {
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const accountID = accountRows[0].account_id;
        const [friendshipRows] = await db_1.dbPool.execute(`SELECT
        friend_id
      FROM
        Friendships
      WHERE
        friendship_id = ?;`, [requestData.friendshipID]);
        if (friendshipRows.length === 0) {
            res.status(404).json({ success: false, message: 'Friend not found.' });
            return;
        }
        ;
        const friendID = friendshipRows[0].friend_id;
        await db_1.dbPool.execute(`DELETE FROM
        Friendships
      WHERE
        (account_id = ? AND friend_id = ?) OR
        (account_id = ? AND friend_id = ?)
      LIMIT 2;`, [accountID, friendID, friendID, accountID]);
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
