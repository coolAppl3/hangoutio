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
const tokenGenerator_1 = require("../util/tokenGenerator");
const requestValidation_1 = require("../util/validation/requestValidation");
const emailServices_1 = require("../util/email/emailServices");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const isSqlError_1 = require("../util/isSqlError");
const authSessions_1 = require("../auth/authSessions");
const cookieUtils_1 = require("../util/cookieUtils");
const authUtils = __importStar(require("../auth/authUtils"));
const accountServices_1 = require("../util/accountServices");
const constants_1 = require("../util/constants");
const hangoutWebSocketServer_1 = require("../webSockets/hangout/hangoutWebSocketServer");
const errorLogger_1 = require("../logs/errorLogger");
const hangoutValidation_1 = require("../util/validation/hangoutValidation");
const addHangoutEvent_1 = require("../util/addHangoutEvent");
exports.accountsRouter = express_1.default.Router();
exports.accountsRouter.post('/signUp', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['email', 'username', 'displayName', 'password'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidEmail(requestData.email)) {
        res.status(400).json({ message: 'Invalid email address.', reason: 'invalidEmail' });
        return;
    }
    ;
    if (!userValidation.isValidUsername(requestData.username)) {
        res.status(400).json({ message: 'Invalid username.', reason: 'invalidUsername' });
        return;
    }
    ;
    if (!userValidation.isValidDisplayName(requestData.displayName)) {
        res.status(400).json({ message: 'Invalid display name.', reason: 'invalidDisplayName' });
        return;
    }
    ;
    if (!userValidation.isValidNewPassword(requestData.password)) {
        res.status(400).json({ message: 'Invalid password.', reason: 'invalidPassword' });
        return;
    }
    ;
    if (requestData.username === requestData.password) {
        res.status(409).json({ message: `Password can't be identical to username.`, reason: 'passwordEqualsUsername' });
        return;
    }
    ;
    const existingAuthSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (existingAuthSessionId) {
        res.status(403).json({ message: 'You must sign out before proceeding.', reason: 'signedIn' });
        return;
    }
    ;
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        const [emailUsernameRows] = await connection.execute(`(SELECT 1 AS taken_status FROM accounts WHERE email = :email LIMIT 1)
      UNION ALL
      (SELECT 1 AS taken_status FROM email_update WHERE new_email = :email LIMIT 1)
      UNION ALL
      (SELECT 2 AS taken_status FROM accounts WHERE username = :username LIMIT 1)
      UNION ALL
      (SELECT 2 AS taken_status FROM guests WHERE username = :username LIMIT 1);`, { email: requestData.email, username: requestData.username });
        if (emailUsernameRows.length > 0) {
            await connection.rollback();
            const takenDataSet = new Set();
            emailUsernameRows.forEach((row) => takenDataSet.add(row.taken_status));
            if (takenDataSet.has(1) && takenDataSet.has(2)) {
                res.status(409).json({
                    message: 'Email address and username are both already taken.',
                    reason: 'emailAndUsernameTaken',
                });
                return;
            }
            ;
            if (takenDataSet.has(1)) {
                res.status(409).json({ message: 'Email address is already taken.', reason: 'emailTaken' });
                return;
            }
            ;
            if (takenDataSet.has(2)) {
                res.status(409).json({ message: 'Username is already taken.', reason: 'usernameTaken' });
                return;
            }
            ;
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Username or email taken, but rows not returned properly.', trace: null });
            return;
        }
        ;
        const verificationCode = (0, tokenGenerator_1.generateRandomCode)();
        const hashedPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const createdOnTimestamp = Date.now();
        const verificationExpiryTimestamp = createdOnTimestamp + constants_1.ACCOUNT_VERIFICATION_WINDOW;
        const [resultSetHeader] = await connection.execute(`INSERT INTO accounts (
        email,
        hashed_password,
        username,
        display_name,
        created_on_timestamp,
        is_verified,
        failed_sign_in_attempts
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(7)});`, [requestData.email, hashedPassword, requestData.username, requestData.displayName, createdOnTimestamp, false, 0]);
        const accountId = resultSetHeader.insertId;
        await connection.execute(`INSERT INTO account_verification (
        account_id,
        verification_code,
        verification_emails_sent,
        failed_verification_attempts,
        expiry_timestamp
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [accountId, verificationCode, 1, 0, verificationExpiryTimestamp]);
        await connection.commit();
        res.status(201).json({ accountId, verificationExpiryTimestamp });
        await (0, emailServices_1.sendVerificationEmail)({
            to: requestData.email,
            accountId,
            verificationCode,
            displayName: requestData.displayName,
            expiryTimestamp: verificationExpiryTimestamp,
        });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, err);
            return;
        }
        ;
        const sqlError = err;
        if (sqlError.errno === 1062 && sqlError.sqlMessage?.endsWith(`for key 'email'`)) {
            res.status(409).json({ message: 'Email address is already taken.', reason: 'emailTaken' });
            return;
        }
        ;
        if (sqlError.errno === 1062 && sqlError.sqlMessage?.endsWith(`for key 'username'`)) {
            res.status(409).json({ message: 'Username is already taken.', reason: 'usernameTaken' });
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.accountsRouter.post('/verification/resendEmail', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['accountId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountId)) {
        res.status(400).json({ message: 'Invalid account ID.', reason: 'invalidAccountId' });
        return;
    }
    ;
    const existingAuthSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (existingAuthSessionId) {
        res.status(403).json({ message: 'You must sign out before proceeding.', reason: 'signedIn' });
        return;
    }
    ;
    try {
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.email,
        accounts.display_name,
        accounts.is_verified,
        account_verification.verification_id,
        account_verification.verification_code,
        account_verification.verification_emails_sent,
        account_verification.expiry_timestamp
      FROM
        accounts
      LEFT JOIN
        account_verification ON accounts.account_id = account_verification.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`, [requestData.accountId]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            res.status(404).json({ message: 'Account not found.' });
            return;
        }
        ;
        if (accountDetails.is_verified) {
            res.status(409).json({ message: 'Account already verified.', reason: 'alreadyVerified' });
            return;
        }
        ;
        if (!accountDetails.verification_id) {
            res.status(404).json({ message: 'Verification request not found.' });
            return;
        }
        ;
        if (accountDetails.verification_emails_sent >= constants_1.EMAILS_SENT_LIMIT) {
            res.status(403).json({ message: `Verification emails limit of ${constants_1.EMAILS_SENT_LIMIT} reached.`, reason: 'emailLimitReached' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        account_verification
      SET
        verification_emails_sent = verification_emails_sent + 1
      WHERE
        verification_id = ?;`, [accountDetails.verification_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        res.json({ verificationEmailsSent: accountDetails.verification_emails_sent + 1 });
        await (0, emailServices_1.sendVerificationEmail)({
            to: accountDetails.email,
            accountId: requestData.accountId,
            verificationCode: accountDetails.verification_code,
            displayName: accountDetails.display_name,
            expiryTimestamp: accountDetails.expiry_timestamp,
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.patch('/verification/verify', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['accountId', 'verificationCode'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountId)) {
        res.status(400).json({ message: 'Invalid account ID.', reason: 'invalidAccountId' });
        return;
    }
    ;
    if (!userValidation.isValidRandomCode(requestData.verificationCode)) {
        res.status(400).json({ message: 'Invalid verification code.', reason: 'invalidVerificationCode' });
        return;
    }
    ;
    const existingAuthSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (existingAuthSessionId) {
        res.status(403).json({ message: 'You must sign out before proceeding.', reason: 'signedIn' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.is_verified,
        account_verification.verification_id,
        account_verification.verification_code,
        account_verification.failed_verification_attempts
      FROM
        accounts
      LEFT JOIN
        account_verification ON accounts.account_id = account_verification.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`, [requestData.accountId]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            res.status(404).json({ message: 'Account not found.' });
            return;
        }
        ;
        if (accountDetails.is_verified) {
            res.status(409).json({ message: 'Account already verified.' });
            return;
        }
        ;
        const isCorrectVerificationCode = requestData.verificationCode === accountDetails.verification_code;
        if (!isCorrectVerificationCode) {
            if (accountDetails.failed_verification_attempts + 1 >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT) {
                await db_1.dbPool.execute(`DELETE FROM
            accounts
          WHERE
            account_id = ?;`, [requestData.accountId]);
                res.status(401).json({ message: 'Incorrect verification code.', reason: 'accountDeleted' });
                return;
            }
            ;
            await db_1.dbPool.execute(`UPDATE
          account_verification
        SET
          failed_verification_attempts = failed_verification_attempts + 1
        WHERE
          verification_id = ?;`, [accountDetails.verification_id]);
            res.status(401).json({ message: 'Incorrect verification code.', reason: 'incorrectCode' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const [firstResultSetHeader] = await connection.execute(`UPDATE
        accounts
      SET
        is_verified = ?
      WHERE
        account_id = ?;`, [true, requestData.accountId]);
        if (firstResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        const [secondResultSetHeader] = await connection.execute(`DELETE FROM
        account_verification
      WHERE
        verification_id = ?;`, [accountDetails.verification_id]);
        if (secondResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to delete rows.', trace: null });
            return;
        }
        ;
        await connection.commit();
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: requestData.accountId,
            user_type: 'account',
            keepSignedIn: false,
        });
        res.json({ authSessionCreated });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.accountsRouter.post('/signIn', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['email', 'password', 'keepSignedIn'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidEmail(requestData.email)) {
        res.status(400).json({ message: 'Invalid email address.', reason: 'invalidEmail' });
        return;
    }
    ;
    if (!userValidation.isValidPassword(requestData.password)) {
        res.status(400).json({ message: 'Invalid account password.', reason: 'invalidPassword' });
        return;
    }
    ;
    if (typeof requestData.keepSignedIn !== 'boolean') {
        requestData.keepSignedIn = false;
    }
    ;
    try {
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        account_id,
        hashed_password,
        is_verified,
        failed_sign_in_attempts
      FROM
        accounts
      WHERE
        email = ?
      LIMIT 1;`, [requestData.email]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            res.status(404).json({ message: 'Account not found.' });
            return;
        }
        ;
        if (accountDetails.failed_sign_in_attempts >= constants_1.FAILED_SIGN_IN_LIMIT) {
            res.status(403).json({ message: 'Account locked.', reason: 'accountLocked' });
            return;
        }
        ;
        if (!accountDetails.is_verified) {
            res.status(403).json({ message: 'Account unverified.', reason: 'accountUnverified' });
            return;
        }
        ;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, accountDetails.hashed_password);
        if (!isCorrectPassword) {
            await (0, accountServices_1.handleIncorrectAccountPassword)(res, accountDetails.account_id, accountDetails.failed_sign_in_attempts);
            return;
        }
        ;
        if (accountDetails.failed_sign_in_attempts > 0) {
            await db_1.dbPool.execute(`UPDATE
          accounts
        SET
          failed_sign_in_attempts = 0
        WHERE
          account_id = ?;`, [accountDetails.account_id]);
        }
        ;
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: accountDetails.account_id,
            user_type: 'account',
            keepSignedIn: requestData.keepSignedIn,
        });
        if (!authSessionCreated) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to create auth session.', trace: null });
            return;
        }
        ;
        res.json({});
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.post('/recovery/start', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['email'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidEmail(requestData.email)) {
        res.status(400).json({ message: 'Invalid email address.', reason: 'invalidEmail' });
        return;
    }
    ;
    const existingAuthSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (existingAuthSessionId) {
        res.status(403).json({ message: 'You must sign out before proceeding.', reason: 'signedIn' });
        return;
    }
    ;
    try {
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.account_id,
        accounts.display_name,
        accounts.is_verified,
        account_recovery.expiry_timestamp,
        account_recovery.failed_recovery_attempts
      FROM
        accounts
      LEFT JOIN
        account_recovery ON accounts.account_id = account_recovery.account_id
      WHERE
        accounts.email = ?
      LIMIT 1;`, [requestData.email]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            res.status(404).json({ message: 'Account not found.' });
            return;
        }
        ;
        if (!accountDetails.is_verified) {
            res.status(403).json({ message: `Can't recover an unverified account.`, reason: 'accountUnverified' });
            return;
        }
        ;
        if (accountDetails.expiry_timestamp) {
            if (accountDetails.failed_recovery_attempts >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT) {
                res.status(403).json({
                    message: 'Recovery suspended.',
                    reason: 'recoverySuspended',
                    resData: {
                        expiryTimestamp: accountDetails.expiry_timestamp,
                    },
                });
                return;
            }
            ;
            res.status(409).json({
                message: 'Ongoing recovery request found.',
                reason: 'ongoingRequest',
                resData: {
                    expiryTimestamp: accountDetails.expiry_timestamp,
                    accountId: accountDetails.account_id,
                },
            });
            return;
        }
        ;
        const recoveryCode = (0, tokenGenerator_1.generateRandomCode)();
        const expiryTimestamp = Date.now() + constants_1.ACCOUNT_RECOVERY_WINDOW;
        await db_1.dbPool.execute(`INSERT INTO account_recovery (
          account_id,
          recovery_code,
          expiry_timestamp,
          recovery_emails_sent,
          failed_recovery_attempts
        ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [accountDetails.account_id, recoveryCode, expiryTimestamp, 1, 0]);
        res.status(201).json({ accountId: accountDetails.account_id, expiryTimestamp });
        await (0, emailServices_1.sendRecoveryEmail)({
            to: requestData.email,
            accountId: accountDetails.account_id,
            recoveryCode: recoveryCode,
            expiryTimestamp,
            displayName: accountDetails.display_name,
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.post('/recovery/resendEmail', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['accountId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountId)) {
        res.status(400).json({ message: 'Invalid account ID.' });
        return;
    }
    ;
    try {
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.email,
        accounts.display_name,
        account_recovery.recovery_code,
        account_recovery.expiry_timestamp,
        account_recovery.recovery_emails_sent,
        account_recovery.failed_recovery_attempts
      FROM
        accounts
      LEFT JOIN
        account_recovery ON accounts.account_id = account_recovery.account_id
      WHERE
        accounts.account_id = ?;`, [requestData.accountId]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            res.status(404).json({ message: 'Account not found.', reason: 'accountNotFound' });
            return;
        }
        ;
        if (!accountDetails.recovery_code) {
            res.status(404).json({ message: 'Recovery request not found or may have expired.', reason: 'requestNotFound' });
            return;
        }
        ;
        if (accountDetails.failed_recovery_attempts >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT) {
            res.status(403).json({
                message: 'Recovery suspended.',
                reason: 'recoverySuspended',
                resData: { expiryTimestamp: accountDetails.expiry_timestamp },
            });
            return;
        }
        ;
        if (accountDetails.recovery_emails_sent >= constants_1.EMAILS_SENT_LIMIT) {
            res.status(403).json({ message: `Recovery emails limit of ${constants_1.EMAILS_SENT_LIMIT} reached.`, reason: 'limitReached' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        account_recovery
      SET
        recovery_emails_sent = recovery_emails_sent + 1
      WHERE
        account_id = ?
      LIMIT 1;`, [requestData.accountId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        res.json({});
        await (0, emailServices_1.sendRecoveryEmail)({
            to: accountDetails.email,
            accountId: accountDetails.user_id,
            recoveryCode: accountDetails.recovery_code,
            expiryTimestamp: accountDetails.expiry_timestamp,
            displayName: accountDetails.display_name,
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.patch('/recovery/updatePassword', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['accountId', 'recoveryCode', 'newPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountId)) {
        res.status(400).json({ message: 'Invalid account ID.' });
        return;
    }
    ;
    if (!userValidation.isValidRandomCode(requestData.recoveryCode)) {
        res.status(400).json({ message: 'Invalid recovery code.', reason: 'invalidRecoveryCode' });
        return;
    }
    ;
    if (!userValidation.isValidNewPassword(requestData.newPassword)) {
        res.status(400).json({ message: 'Invalid new password.', reason: 'invalidPassword' });
        return;
    }
    ;
    const existingAuthSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (existingAuthSessionId) {
        res.status(403).json({ message: `You can't recover an account while signed in.`, reason: 'signedIn' });
        return;
    }
    ;
    try {
        ;
        const [recoveryRows] = await db_1.dbPool.execute(`SELECT
        recovery_id,
        recovery_code,
        failed_recovery_attempts,
        expiry_timestamp,
        (SELECT username FROM accounts WHERE account_id = :accountId) AS username
      FROM
        account_recovery
      WHERE
        account_id = :accountId
      LIMIT 1;`, { accountId: requestData.accountId });
        const recoveryDetails = recoveryRows[0];
        if (!recoveryDetails) {
            res.status(404).json({ message: 'Recovery request not found.' });
            return;
        }
        ;
        if (recoveryDetails.failed_recovery_attempts >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT) {
            res.status(403).json({
                message: 'Recovery suspended.',
                reason: 'recoverySuspended',
                resData: {
                    expiryTimestamp: recoveryDetails.expiry_timestamp,
                },
            });
            return;
        }
        ;
        if (requestData.recoveryCode !== recoveryDetails.recovery_code) {
            await db_1.dbPool.execute(`UPDATE
          account_recovery
        SET
          failed_recovery_attempts = failed_recovery_attempts + 1
        WHERE
          recovery_id = ?;`, [recoveryDetails.recovery_id]);
            if (recoveryDetails.failed_recovery_attempts + 1 >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT) {
                res.status(401).json({
                    message: 'Incorrect recovery code.',
                    reason: 'recoverySuspended',
                    resData: {
                        expiryTimestamp: recoveryDetails.expiry_timestamp,
                    },
                });
                return;
            }
            ;
            res.status(401).json({ message: 'Incorrect recovery code.', reason: 'incorrectRecoveryCode' });
            return;
        }
        ;
        if (recoveryDetails.username === requestData.newPassword) {
            res.status(409).json({ message: `New password can't be identical to username.` });
            return;
        }
        ;
        const newHashedPassword = await bcrypt_1.default.hash(requestData.newPassword, 10);
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        accounts
      SET
        hashed_password = ?,
        failed_sign_in_attempts = ?
      WHERE
        account_id = ?;`, [newHashedPassword, 0, requestData.accountId]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        await db_1.dbPool.execute(`DELETE FROM
        account_recovery
      WHERE
        recovery_id = ?;`, [recoveryDetails.recovery_id]);
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: requestData.accountId,
            user_type: 'account',
            keepSignedIn: false,
        });
        res.json({ authSessionCreated });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.patch('/details/updateDisplayName', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['password', 'newDisplayName'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidPassword(requestData.password)) {
        res.status(400).json({ message: 'Invalid password.', reason: 'invalidPassword' });
        return;
    }
    ;
    if (!userValidation.isValidDisplayName(requestData.newDisplayName)) {
        res.status(400).json({ message: 'Invalid display name.', reason: 'invalidDisplayName' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        hashed_password,
        failed_sign_in_attempts,
        display_name
      FROM
        accounts
      WHERE
        account_id = ?;`, [authSessionDetails.user_id]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, accountDetails.hashed_password);
        if (!isCorrectPassword) {
            await (0, accountServices_1.handleIncorrectAccountPassword)(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
            return;
        }
        ;
        if (requestData.newDisplayName === accountDetails.display_name) {
            res.status(409).json({ message: `Your display name is already ${requestData.newDisplayName}.` });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const [resultSetHeader] = await connection.execute(`UPDATE
        accounts
      SET
        display_name = ?
      WHERE
        account_id = ?;`, [requestData.newDisplayName, authSessionDetails.user_id]);
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        await connection.execute(`UPDATE
        hangout_members
      SET
        display_name = ?
      WHERE
        account_id = ?;`, [requestData.newDisplayName, authSessionDetails.user_id]);
        await connection.commit();
        res.json({});
        ;
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        hangout_member_id,
        hangout_id
      FROM
        hangout_members
      WHERE
        account_id = ?;`, [authSessionDetails.user_id]);
        if (hangoutMemberRows.length === 0) {
            return;
        }
        ;
        const eventTimestamp = Date.now();
        const eventDescription = `${accountDetails.display_name} changed his name to ${requestData.newDisplayName}.`;
        for (const row of hangoutMemberRows) {
            await (0, addHangoutEvent_1.addHangoutEvent)(row.hangout_id, eventDescription, eventTimestamp);
            (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([row.hangout_id], {
                type: 'misc',
                reason: 'memberUpdatedDisplayName',
                data: {
                    hangoutMemberId: row.hangout_member_id,
                    newDisplayName: requestData.newDisplayName,
                    eventTimestamp,
                    eventDescription,
                },
            });
        }
        ;
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.accountsRouter.patch('/details/updatePassword', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['currentPassword', 'newPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidPassword(requestData.currentPassword)) {
        res.status(400).json({ message: 'Invalid password.', reason: 'invalidCurrentPassword' });
        return;
    }
    ;
    if (!userValidation.isValidNewPassword(requestData.newPassword)) {
        res.status(400).json({ message: 'Invalid new password.', reason: 'invalidNewPassword' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        hashed_password,
        failed_sign_in_attempts,
        username
      FROM
        accounts
      WHERE
        account_id = ?;`, [authSessionDetails.user_id]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.currentPassword, accountDetails.hashed_password);
        if (!isCorrectPassword) {
            await (0, accountServices_1.handleIncorrectAccountPassword)(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
            return;
        }
        ;
        const areIdenticalPasswords = await bcrypt_1.default.compare(requestData.newPassword, accountDetails.hashed_password);
        if (areIdenticalPasswords) {
            res.status(409).json({ message: `New password can't be identical to your current password.`, reason: 'identicalPasswords' });
            return;
        }
        ;
        if (accountDetails.username === requestData.newPassword) {
            res.status(409).json({ message: `New password can't be identical to your username.`, reason: 'passwordEqualsUsername' });
            return;
        }
        ;
        const newHashedPassword = await bcrypt_1.default.hash(requestData.newPassword, 10);
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        accounts
      SET
        hashed_password = ?
      WHERE
        account_id = ?;`, [newHashedPassword, authSessionDetails.user_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'account');
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: authSessionDetails.user_id,
            user_type: 'account',
            keepSignedIn: false,
        });
        res.json({ authSessionCreated });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.post('/details/updateEmail/start', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['password', 'newEmail'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidEmail(requestData.newEmail)) {
        res.status(400).json({ message: 'Invalid email address.', reason: 'email' });
        return;
    }
    ;
    if (!userValidation.isValidPassword(requestData.password)) {
        res.status(400).json({ message: 'Invalid password.', reason: 'password' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.hashed_password,
        accounts.email,
        accounts.display_name,
        accounts.failed_sign_in_attempts,
        email_update.expiry_timestamp,
        email_update.failed_update_attempts,
        EXISTS (SELECT 1 FROM account_deletion WHERE account_id = :accountId) AS ongoing_deletion_request
      FROM
        accounts
      LEFT JOIN
        email_update ON accounts.account_id = email_update.account_id
      WHERE
        accounts.account_id = :accountId;`, { accountId: authSessionDetails.user_id });
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, accountDetails.hashed_password);
        if (!isCorrectPassword) {
            await (0, accountServices_1.handleIncorrectAccountPassword)(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
            return;
        }
        ;
        if (accountDetails.expiry_timestamp) {
            if (accountDetails.failed_update_attempts >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT) {
                res.status(403).json({
                    message: 'Request is suspended due to too many failed attempts.',
                    resData: { expiryTimestamp: accountDetails.expiry_timestamp },
                });
                return;
            }
            ;
            res.status(409).json({
                message: 'Ongoing email update request found.',
                reason: 'ongoingRequest',
                resData: { expiryTimestamp: accountDetails.expiry_timestamp },
            });
            return;
        }
        ;
        if (accountDetails.ongoing_deletion_request) {
            res.status(409).json({ message: 'Account deletion request found.', reason: 'ongoingAccountDeletion' });
            return;
        }
        ;
        if (requestData.newEmail === accountDetails.email) {
            res.status(409).json({ message: 'This email is already assigned to your account.', reason: 'identicalEmail' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        const [emailRows] = await connection.execute(`(SELECT 1 FROM accounts WHERE email = :newEmail LIMIT 1)
      UNION ALL
      (SELECT 1 FROM email_update WHERE new_email = :newEmail LIMIT 1);`, { newEmail: requestData.newEmail });
        if (emailRows.length > 0) {
            await connection.rollback();
            res.status(409).json({ message: 'Email address is already taken.', reason: 'emailTaken' });
            return;
        }
        ;
        const newConfirmationCode = (0, tokenGenerator_1.generateRandomCode)();
        const expiryTimestamp = Date.now() + constants_1.ACCOUNT_EMAIL_UPDATE_WINDOW;
        await connection.execute(`INSERT INTO email_update (
          account_id,
          new_email,
          confirmation_code,
          expiry_timestamp,
          update_emails_sent,
          failed_update_attempts
        ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [authSessionDetails.user_id, requestData.newEmail, newConfirmationCode, expiryTimestamp, 1, 0]);
        await connection.commit();
        res.json({});
        await (0, emailServices_1.sendEmailUpdateEmail)({
            to: requestData.newEmail,
            confirmationCode: newConfirmationCode,
            displayName: accountDetails.display_name,
        });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.accountsRouter.get('/details/updateEmail/resendEmail', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [emailUpdateRows] = await db_1.dbPool.execute(`SELECT
        new_email,
        confirmation_code,
        expiry_timestamp,
        update_emails_sent,
        failed_update_attempts,
        (SELECT display_name FROM accounts WHERE account_id = :accountId) AS display_name
      FROM
        email_update
      WHERE
        account_id = :accountId
      LIMIT 1;`, { accountId: authSessionDetails.user_id });
        const emailUpdateDetails = emailUpdateRows[0];
        if (!emailUpdateDetails) {
            res.status(404).json({ message: 'Email update request not found or may have expired.' });
            return;
        }
        ;
        if (emailUpdateDetails.failed_update_attempts >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT) {
            res.status(403).json({
                message: 'Request is suspended due to too many failed attempts.',
                resData: { expiryTimestamp: emailUpdateDetails.expiry_timestamp },
            });
            return;
        }
        ;
        if (emailUpdateDetails.update_emails_sent >= constants_1.EMAILS_SENT_LIMIT) {
            res.status(409).json({ message: `Confirmation emails limit of ${constants_1.EMAILS_SENT_LIMIT} reached.` });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        email_update
      SET
        update_emails_sent = update_emails_sent + 1
      WHERE
        account_id = ?
      LIMIT 1;`, [authSessionDetails.user_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        res.json({});
        await (0, emailServices_1.sendEmailUpdateEmail)({
            to: emailUpdateDetails.new_email,
            confirmationCode: emailUpdateDetails.confirmation_code,
            displayName: emailUpdateDetails.display_name,
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.patch('/details/updateEmail/confirm', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['confirmationCode'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidRandomCode(requestData.confirmationCode)) {
        res.status(400).json({ message: 'Invalid confirmation code.', reason: 'confirmationCode' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.email,
        accounts.display_name,
        email_update.update_id,
        email_update.new_email,
        email_update.confirmation_code,
        email_update.expiry_timestamp,
        email_update.failed_update_attempts
      FROM
        accounts
      LEFT JOIN
        email_update ON accounts.account_id = email_update.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`, [authSessionDetails.user_id]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (!accountDetails.update_id) {
            res.status(404).json({ message: 'Email update request not found or may have expired.' });
            return;
        }
        ;
        if (accountDetails.failed_update_attempts >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT) {
            res.status(403).json({
                message: 'Email update request suspended.',
                resData: { expiryTimestamp: accountDetails.expiry_timestamp },
            });
            return;
        }
        ;
        if (requestData.confirmationCode !== accountDetails.confirmation_code) {
            const requestSuspended = accountDetails.failed_update_attempts + 1 >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT;
            const expiryTimestamp = Date.now() + constants_1.ACCOUNT_EMAIL_UPDATE_WINDOW;
            const suspendRequestQuery = requestSuspended ? `, expiry_timestamp = ${expiryTimestamp}` : '';
            await db_1.dbPool.execute(`UPDATE
            email_update
          SET
            failed_update_attempts = failed_update_attempts + 1
            ${suspendRequestQuery}
          WHERE
            update_id = ?;`, [Date.now(), accountDetails.update_id]);
            if (requestSuspended) {
                await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'account');
                (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            }
            ;
            res.status(401).json({
                message: 'Incorrect confirmation code.',
                reason: requestSuspended ? 'requestSuspended' : 'incorrectCode',
                data: requestSuspended ? { expiryTimestamp } : null,
            });
            if (requestSuspended) {
                await (0, emailServices_1.sendEmailUpdateWarningEmail)(accountDetails.email, accountDetails.display_name);
            }
            ;
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const [firstResultSetHeader] = await connection.execute(`UPDATE
        accounts
      SET
        email = ?
      WHERE
        account_id = ?;`, [accountDetails.new_email, authSessionDetails.user_id]);
        if (firstResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        const [secondResultSetHeader] = await connection.execute(`DELETE FROM
        email_update
      WHERE
        account_id = ?
      LIMIT 1;`, [authSessionDetails.user_id]);
        if (secondResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to delete rows.', trace: null });
            return;
        }
        ;
        await connection.commit();
        await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'account');
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: authSessionDetails.user_id,
            user_type: 'account',
            keepSignedIn: false,
        });
        res.json({ authSessionCreated, newEmail: accountDetails.new_email });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.accountsRouter.delete('/details/updateEmail/abort', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)('authSessionId');
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        email_update
      WHERE
        account_id = ?
      LIMIT 1;`, [authSessionDetails.user_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(404).json({ message: 'Email update request not found or may have expired.' });
            return;
        }
        ;
        res.json({});
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.delete(`/deletion/start`, async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['password'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidPassword(requestData.password)) {
        res.status(400).json({ message: 'Invalid password.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)('authSessionId');
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.email,
        accounts.hashed_password,
        accounts.display_name,
        accounts.failed_sign_in_attempts,
        account_deletion.expiry_timestamp,
        account_deletion.failed_deletion_attempts,
        EXISTS (SELECT 1 FROM email_update WHERE account_id = :accountId) AS ongoing_email_update
      FROM
        accounts
      LEFT JOIN
        account_deletion ON accounts.account_id = account_deletion.account_id
      WHERE
        accounts.account_id = :accountId;`, { accountId: authSessionDetails.user_id });
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, accountDetails.hashed_password);
        if (!isCorrectPassword) {
            await (0, accountServices_1.handleIncorrectAccountPassword)(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
            return;
        }
        ;
        if (!accountDetails.expiry_timestamp) {
            if (accountDetails.ongoing_email_update) {
                res.status(409).json({ message: 'Ongoing email update request found.', reason: 'ongoingEmailUpdate' });
                return;
            }
            ;
            const confirmationCode = (0, tokenGenerator_1.generateRandomCode)();
            const expiryTimestamp = Date.now() + constants_1.ACCOUNT_DELETION_WINDOW;
            await db_1.dbPool.execute(`INSERT INTO account_deletion (
          account_id,
          confirmation_code,
          expiry_timestamp,
          deletion_emails_sent,
          failed_deletion_attempts
        ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [authSessionDetails.user_id, confirmationCode, expiryTimestamp, 1, 0]);
            res.json({});
            await (0, emailServices_1.sendDeletionConfirmationEmail)({
                to: accountDetails.email,
                confirmationCode,
                displayName: accountDetails.display_name,
            });
            return;
        }
        ;
        const requestSuspended = accountDetails.failed_deletion_attempts >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT;
        if (requestSuspended) {
            res.status(403).json({
                message: 'Deletion request suspended.',
                resData: { expiryTimestamp: accountDetails.expiry_timestamp },
            });
            return;
        }
        ;
        res.status(409).json({
            message: 'Ongoing deletion request found.',
            reason: 'requestDetected',
            resData: { expiryTimestamp: accountDetails.expiry_timestamp },
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.get('/deletion/resendEmail', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)('authSessionId');
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.email,
        accounts.display_name,
        account_deletion.confirmation_code,
        account_deletion.expiry_timestamp,
        account_deletion.deletion_emails_sent,
        account_deletion.failed_deletion_attempts
      FROM
        accounts
      LEFT JOIN
        account_deletion ON accounts.account_id = account_deletion.account_id
      WHERE
        accounts.account_id = ?`, [authSessionDetails.user_id]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (!accountDetails.confirmation_code) {
            res.status(404).json({ message: 'Deletion request not found.' });
            return;
        }
        ;
        const requestSuspended = accountDetails.failed_deletion_attempts >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT;
        if (requestSuspended) {
            res.status(403).json({
                message: 'Deletion request suspended.',
                resData: { expiryTimestamp: accountDetails.expiry_timestamp },
            });
            return;
        }
        ;
        if (accountDetails.deletion_emails_sent >= constants_1.EMAILS_SENT_LIMIT) {
            res.status(409).json({ message: `Confirmation emails limit of ${constants_1.EMAILS_SENT_LIMIT} reached.` });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        account_deletion
      SET
        deletion_emails_sent = deletion_emails_sent + 1
      WHERE
        account_id = ?
      LIMIT 1;`, [authSessionDetails.user_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to update rows.', trace: null });
            return;
        }
        ;
        res.json({});
        await (0, emailServices_1.sendDeletionConfirmationEmail)({
            to: accountDetails.email,
            confirmationCode: accountDetails.confirmation_code,
            displayName: accountDetails.display_name,
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.delete('/deletion/confirm', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const confirmationCode = req.query.confirmationCode;
    if (typeof confirmationCode !== 'string') {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidRandomCode(confirmationCode)) {
        res.status(400).json({ message: 'Invalid confirmation code.', reason: 'confirmationCode' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.hashed_password,
        accounts.failed_sign_in_attempts,
        accounts.email,
        accounts.display_name,
        account_deletion.deletion_id,
        account_deletion.confirmation_code,
        account_deletion.expiry_timestamp,
        account_deletion.failed_deletion_attempts
      FROM
        accounts
      LEFT JOIN
        account_deletion ON accounts.account_id = account_deletion.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`, [authSessionDetails.user_id]);
        const accountDetails = accountRows[0];
        if (!accountDetails) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Invalid credentials. Request denied.', reason: 'authSessionDestroyed' });
            return;
        }
        ;
        if (!accountDetails.deletion_id) {
            res.status(404).json({ message: 'Deletion request not found.' });
            return;
        }
        ;
        const requestSuspended = accountDetails.failed_deletion_attempts >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT;
        if (requestSuspended) {
            res.status(403).json({
                message: 'Deletion request suspended.',
                resData: { expiryTimestamp: accountDetails.expiry_timestamp },
            });
            return;
        }
        ;
        const isCorrectConfirmationCode = accountDetails.confirmation_code === confirmationCode;
        if (!isCorrectConfirmationCode) {
            const toBeSuspended = accountDetails.failed_deletion_attempts + 1 >= constants_1.FAILED_ACCOUNT_UPDATE_LIMIT;
            if (toBeSuspended) {
                await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'account');
                (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            }
            ;
            const expiryTimestampValue = toBeSuspended
                ? Date.now() + constants_1.ACCOUNT_DELETION_SUSPENSION_WINDOW
                : accountDetails.expiry_timestamp;
            await db_1.dbPool.execute(`UPDATE
          account_deletion
        SET
          failed_deletion_attempts = failed_deletion_attempts + 1,
          expiry_timestamp = ?
        WHERE
          deletion_id = ?;`, [expiryTimestampValue, accountDetails.deletion_id]);
            res.status(401).json({
                message: 'Incorrect confirmation code.',
                reason: toBeSuspended ? 'requestSuspended' : 'incorrectCode',
                resData: toBeSuspended ? { expiryTimestamp: accountDetails.expiry_timestamp } : null,
            });
            if (toBeSuspended) {
                await (0, emailServices_1.sendDeletionWarningEmail)({
                    to: accountDetails.email,
                    displayName: accountDetails.display_name,
                });
            }
            ;
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        accounts
      WHERE
        account_id = ?;`, [authSessionDetails.user_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to delete rows.', trace: null });
            return;
        }
        ;
        await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'account');
        res.json({});
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.delete('/deletion/abort', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)('authSessionId');
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        account_deletion
      WHERE
        account_id = ?
      LIMIT 1;`, [authSessionDetails.user_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(404).json({ message: 'Email update request not found or may have expired.' });
            return;
        }
        ;
        res.json({});
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.post('/friends/requests/send', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['requesteeUsername'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidUsername(requestData.requesteeUsername)) {
        res.status(400).json({ message: 'Invalid username.', reason: 'invalidUsername' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [requesteeRows] = await db_1.dbPool.execute(`SELECT
        account_id AS requestee_id
      FROM
        accounts
      WHERE
        username = ?
      LIMIT 1;`, [requestData.requesteeUsername]);
        const requesteeId = requesteeRows[0]?.requestee_id;
        if (!requesteeId) {
            res.status(404).json({ message: 'No users found with this username.' });
            return;
        }
        ;
        if (requesteeId === authSessionDetails.user_id) {
            res.status(409).json({ message: `You can't send a friend request to yourself.` });
            return;
        }
        ;
        ;
        ;
        const [friendshipRows] = await db_1.dbPool.query(`SELECT
        1 AS already_friends
      FROM
        friendships
      WHERE
        account_id = :accountId AND
        friend_id = :requesteeId
      LIMIT 1;
      
      SELECT
        1 AS request_already_sent
      FROM
        friend_requests
      WHERE
        requester_id = :accountId AND
        requestee_id = :requesteeId
      LIMIT 1;`, { accountId: authSessionDetails.user_id, requesteeId });
        if (friendshipRows.length !== 2) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to fetch rows.', trace: null });
            return;
        }
        ;
        const alreadyFriends = friendshipRows[0][0] ? friendshipRows[0][0].already_friends === 1 : false;
        const requestAlreadySent = friendshipRows[1][0] ? friendshipRows[1][0].request_already_sent === 1 : false;
        if (alreadyFriends) {
            res.status(409).json({ message: `You're already friends with this user.` });
            return;
        }
        ;
        if (requestAlreadySent) {
            res.status(409).json({ message: `Friend request already sent.`, reason: 'alreadySent' });
            return;
        }
        ;
        await db_1.dbPool.execute(`INSERT INTO friend_requests (
        requester_id,
        requestee_id,
        request_timestamp
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [authSessionDetails.user_id, requesteeId, Date.now()]);
        res.json({});
        return;
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, err);
            return;
        }
        ;
        if (err.errno === 1062) {
            res.status(409).json({ message: `Friend request already sent.`, reason: 'alreadySent' });
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.post('/friends/requests/accept', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['friendRequestId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.friendRequestId)) {
        res.status(400).json({ message: 'Invalid friend request ID.' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [friendRequestRows] = await db_1.dbPool.execute(`SELECT
        requester_id
      FROM
        friend_requests
      WHERE
        request_id = ?;`, [requestData.friendRequestId]);
        const requesterId = friendRequestRows[0]?.requester_id;
        if (!requesterId) {
            res.status(404).json({ message: 'Friend request not found.' });
            return;
        }
        ;
        const friendshipTimestamp = Date.now();
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const insertValues = `
      (${authSessionDetails.user_id}, ${requesterId}, ${friendshipTimestamp}),
      (${requesterId}, ${authSessionDetails.user_id}, ${friendshipTimestamp})
    `;
        const [firstResultSetHeader] = await connection.execute(`INSERT INTO friendships (
        account_id,
        friend_id,
        friendship_timestamp
      ) VALUES ${insertValues};`);
        const [secondResultSetHeader] = await connection.execute(`DELETE FROM
        friend_requests
      WHERE
        (requester_id = :requesterId AND requestee_id = :accountId) OR
        (requester_id = :accountId AND requestee_id = :requesterId)
      LIMIT 2;`, { accountId: authSessionDetails.user_id, requesterId });
        if (secondResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to delete rows.', trace: null });
            return;
        }
        ;
        await connection.commit();
        res.json({
            friendship_id: firstResultSetHeader.insertId,
            friendship_timestamp: friendshipTimestamp,
        });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, err);
            return;
        }
        ;
        const sqlError = err;
        if (sqlError.errno === 1062) {
            res.status(409).json({ message: 'Already friends with this user.' });
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    finally {
        connection?.release();
    }
    ;
});
exports.accountsRouter.delete('/friends/requests/reject', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const friendRequestId = req.query.friendRequestId;
    if (typeof friendRequestId !== 'string') {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(+friendRequestId)) {
        res.status(400).json({ message: 'Invalid friend request ID.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        friend_requests
      WHERE
        request_id = ?;`, [+friendRequestId]);
        if (resultSetHeader.affectedRows === 0) {
            res.json({});
            return;
        }
        ;
        res.json({});
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.delete('/friends/manage/remove', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const friendshipId = req.query.friendshipId;
    if (typeof friendshipId !== 'string') {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(+friendshipId)) {
        res.status(400).json({ message: 'Invalid friendship ID.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [friendshipRows] = await db_1.dbPool.execute(`SELECT
        friend_id
      FROM
        friendships
      WHERE
        friendship_id = ?;`, [+friendshipId]);
        const friendId = friendshipRows[0]?.friend_id;
        if (!friendId) {
            res.status(404).json({ message: 'Friend not found.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        friendships
      WHERE
        (account_id = :accountId AND friend_id = :friendId) OR
        (account_id = :friendId AND friend_id = :accountId)
      LIMIT 2;`, { accountId: authSessionDetails.user_id, friendId });
        if (resultSetHeader.affectedRows !== 2) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to delete rows.', trace: null });
            return;
        }
        ;
        res.json({});
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.get('/friends', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const offset = req.query.offset;
    if (typeof offset !== 'string' || !Number.isInteger(+offset)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [friendRows] = await db_1.dbPool.execute(`SELECT
        friendships.friendship_id,
        friendships.friendship_timestamp,
        accounts.username AS friend_username,
        accounts.display_name AS friend_display_name
      FROM
        friendships
      INNER JOIN
        accounts ON friendships.friend_id = accounts.account_id
      WHERE
        friendships.account_id = ?
      LIMIT ? OFFSET ?;`, [authSessionDetails.user_id, constants_1.ACCOUNT_FRIENDS_FETCH_BATCH_SIZE, +offset]);
        res.json({ friends: friendRows });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.post('/hangoutInvite', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['hangoutId', 'friendshipId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    if (!(0, hangoutValidation_1.isValidHangoutId)(requestData.hangoutId)) {
        res.status(400).json({ message: 'Invalid hangout ID.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.friendshipId)) {
        res.status(400).json({ message: 'Invalid friendship ID.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [invitationRows] = await db_1.dbPool.execute(`SELECT
        friendships.friend_id,
        EXISTS (SELECT 1 FROM hangouts WHERE hangout_id = :hangoutId) AS hangout_exists,
        EXISTS (SELECT 1 FROM hangout_invites WHERE account_id = :accountId AND friend_id = friendships.friend_id) AS invitation_already_sent,
        EXISTS (SELECT 1 FROM hangout_members WHERE hangout_id = :hangoutId AND account_id = :accountId) AS sender_in_hangout,
        EXISTS (SELECT 1 FROM hangout_members WHERE hangout_id = :hangoutId AND account_id = friendships.friend_id) AS invitee_in_hangout
      FROM
        friendships
      WHERE
        friendships.friendship_id = :friendshipId AND
        friendships.account_id = :accountId;`, { hangoutId: requestData.hangoutId, accountId: authSessionDetails.user_id, friendshipId: requestData.friendshipId });
        const invitationDetails = invitationRows[0];
        if (!invitationDetails) {
            res.status(404).json({ message: 'Friend not found.', reason: 'friendNotfound' });
            return;
        }
        ;
        if (!invitationDetails.hangout_exists) {
            res.status(404).json({ message: 'Hangout not found.', reason: 'hangoutNotFound' });
            return;
        }
        ;
        if (invitationDetails.friend_id === authSessionDetails.user_id) {
            res.status(409).json({ message: `Can't invite yourself to a hangout.`, reason: 'selfInvite' });
            return;
        }
        ;
        if (invitationDetails.invitation_already_sent) {
            res.status(409).json({ message: 'Invitation already sent.', reason: 'alreadySent' });
            return;
        }
        ;
        if (!invitationDetails.sender_in_hangout) {
            res.status(409).json({ message: `You can't invite friends to a hangout you're not a part of.`, reason: 'notInHangout' });
            return;
        }
        ;
        if (invitationDetails.invitee_in_hangout) {
            res.status(409).json({ message: 'User has already joined the hangout.', reason: 'alreadyInHangout' });
            return;
        }
        ;
        await db_1.dbPool.execute(`INSERT INTO hangout_invites (
        account_id,
        friend_id,
        hangout_id,
        invite_timestamp
      ) VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(4)});`, [authSessionDetails.user_id, invitationDetails.friend_id, requestData.hangoutId, Date.now()]);
        res.json({});
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        if (!(0, isSqlError_1.isSqlError)(err)) {
            return false;
        }
        ;
        if (err.errno === 1062 && err.sqlMessage?.endsWith(`for key 'account_id'`)) {
            res.status(409).json({ message: 'Invitation already sent.', reason: 'alreadySent' });
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.delete('/hangoutInvite/accept', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const inviteId = req.query.inviteId;
    if (typeof inviteId !== 'string' || !Number.isInteger(+inviteId)) {
        res.status(400).json({ message: 'Invalid invitation ID.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        await db_1.dbPool.execute(`DELETE FROM
        hangout_invites
      WHERE
        invite_id = ?;`, [+inviteId]);
        res.json({});
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.get('/hangoutInvites', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const offset = req.query.offset;
    if (typeof offset !== 'string' || !Number.isInteger(+offset)) {
        res.status(400).json({ message: 'Invalid offset value.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [hangoutInviteRows] = await db_1.dbPool.execute(`SELECT
        hangout_invites.invite_id,
        hangout_invites.hangout_id,
        hangout_invites.invite_timestamp,
        accounts.display_name,
        accounts.username,
        (SELECT hangout_title FROM hangouts WHERE hangout_id = hangout_invites.hangout_id) AS hangout_title
      FROM
        hangout_invites
      INNER JOIN
        accounts ON hangout_invites.account_id = accounts.account_id
      WHERE
        hangout_invites.friend_id = ?
      LIMIT ? OFFSET ?;`, [authSessionDetails.user_id, constants_1.HANGOUT_INVITES_FETCH_BATCH_SIZE, +offset]);
        res.json(hangoutInviteRows);
    }
    catch (err) {
        console.log(err);
    }
    ;
});
exports.accountsRouter.get('/', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [accountRows] = await db_1.dbPool.query(`SELECT
        email,
        username,
        display_name,
        created_on_timestamp,
        EXISTS (SELECT 1 FROM email_update WHERE account_id = :accountId) AS ongoing_email_update_request,
        EXISTS (SELECT 1 FROM account_deletion WHERE account_id = :accountId) AS ongoing_account_deletion_request
      FROM
        accounts
      WHERE
        account_id = :accountId;
      
      SELECT
        friendships.friendship_id,
        friendships.friendship_timestamp,
        accounts.username AS friend_username,
        accounts.display_name AS friend_display_name
      FROM
        friendships
      INNER JOIN
        accounts ON friendships.friend_id = accounts.account_id
      WHERE
        friendships.account_id = :accountId;
      
      SELECT
        friend_requests.request_id,
        friend_requests.request_timestamp,
        accounts.username AS requester_username,
        accounts.display_name AS requester_display_name
      FROM
        friend_requests
      INNER JOIN
        accounts ON friend_requests.requester_id = accounts.account_id
      WHERE
        friend_requests.requestee_id = :accountId;
      
      SELECT
        hangouts.hangout_id,
        hangouts.hangout_title,
        hangouts.current_stage,
        hangouts.is_concluded,
        hangouts.created_on_timestamp
      FROM
        hangout_members
      INNER JOIN
        hangouts ON hangout_members.hangout_id = hangouts.hangout_id
      WHERE
        hangout_members.account_id = :accountId
      ORDER BY
        created_on_timestamp DESC
      LIMIT ${constants_1.ACCOUNT_HANGOUT_HISTORY_FETCH_BATCH_SIZE};
      
      SELECT
        hangout_invites.invite_id,
        hangout_invites.hangout_id,
        hangout_invites.invite_timestamp,
        accounts.display_name,
        accounts.username,
        (SELECT hangout_title FROM hangouts WHERE hangout_id = hangout_invites.hangout_id) AS hangout_title
      FROM
        hangout_invites
      INNER JOIN
        accounts ON hangout_invites.account_id = accounts.account_id
      WHERE
        hangout_invites.friend_id = :accountId
      LIMIT ${constants_1.HANGOUT_INVITES_FETCH_BATCH_SIZE};`, { accountId: authSessionDetails.user_id });
        const accountDetails = accountRows[0][0];
        const friends = accountRows[1];
        const friendRequests = accountRows[2];
        const hangoutHistory = accountRows[3];
        const hangoutInvites = accountRows[4];
        if (!accountDetails || !friends || !friendRequests || !hangoutHistory || !hangoutInvites) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to fetch rows.', trace: null });
            return;
        }
        ;
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        COUNT(*) AS hangouts_joined_count,
        CAST(SUM(
          CASE
            WHEN hangouts.is_concluded = 0 THEN 1
            ELSE 0
          END
        ) AS UNSIGNED) AS ongoing_hangouts_count
      FROM
        hangout_members
      INNER JOIN
        hangouts ON hangout_members.hangout_id = hangouts.hangout_id
      WHERE
        hangout_members.account_id = ?;`, [authSessionDetails.user_id]);
        const hangoutCounts = hangoutRows[0];
        if (!hangoutCounts) {
            res.status(500).json({ message: 'Internal server error.' });
            await (0, errorLogger_1.logUnexpectedError)(req, { message: 'Failed to fetch rows.', trace: null });
            return;
        }
        ;
        if (hangoutCounts.hangouts_joined_count === 0) {
            hangoutCounts.ongoing_hangouts_count = 0;
        }
        ;
        res.json({
            accountDetails,
            friends,
            friendRequests,
            hangoutHistory,
            hangoutInvites,
            hangoutsJoinedCount: hangoutCounts.hangouts_joined_count,
            ongoingHangoutsCount: hangoutCounts.ongoing_hangouts_count,
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.get('/hangoutHistory', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const offset = req.query.offset;
    if (typeof offset !== 'string' || !Number.isInteger(+offset)) {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [hangoutRows] = await db_1.dbPool.execute(`SELECT
        hangouts.hangout_id,
        hangouts.hangout_title,
        hangouts.current_stage,
        hangouts.is_concluded,
        hangouts.created_on_timestamp
      FROM
        hangout_members
      INNER JOIN
        hangouts ON hangout_members.hangout_id = hangouts.hangout_id
      WHERE
        hangout_members.account_id = ?
      ORDER BY
        created_on_timestamp DESC
      LIMIT ? OFFSET ?;`, [authSessionDetails.user_id, constants_1.ACCOUNT_HANGOUT_HISTORY_FETCH_BATCH_SIZE, +offset]);
        res.json({ hangouts: hangoutRows });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
exports.accountsRouter.delete('/leaveHangout', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const hangoutId = req.query.hangoutId;
    if (typeof hangoutId !== 'string') {
        res.status(400).json({ message: 'Invalid request data.' });
        return;
    }
    ;
    try {
        ;
        const [authSessionRows] = await db_1.dbPool.execute(`SELECT
        user_id,
        user_type,
        expiry_timestamp
      FROM
        auth_sessions
      WHERE
        session_id = ?;`, [authSessionId]);
        const authSessionDetails = authSessionRows[0];
        if (!authSessionDetails) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
            res.status(401).json({ message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [hangoutMemberRows] = await db_1.dbPool.execute(`DELETE FROM
        hangout_members
      WHERE
        account_id = ? AND
        hangout_id = ?
      LIMIT 1;`, [authSessionDetails.user_id, hangoutId]);
        res.json({});
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (!hangoutMemberDetails) {
            return;
        }
        ;
        (0, hangoutWebSocketServer_1.sendHangoutWebSocketMessage)([hangoutId], {
            type: 'hangoutMember',
            reason: 'memberLeft',
            data: {
                leftMemberId: hangoutMemberDetails.hangout_member_id,
            },
        });
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
        await (0, errorLogger_1.logUnexpectedError)(req, err);
    }
    ;
});
