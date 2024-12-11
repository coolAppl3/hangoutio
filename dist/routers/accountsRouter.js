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
const userUtils = __importStar(require("../util/userUtils"));
const isSqlError_1 = require("../util/isSqlError");
const authSessions_1 = require("../auth/authSessions");
const cookieUtils_1 = require("../util/cookieUtils");
const authUtils = __importStar(require("../auth/authUtils"));
const accountServices_1 = require("../util/accountServices");
exports.accountsRouter = express_1.default.Router();
exports.accountsRouter.post('/signUp', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['email', 'username', 'displayName', 'password'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidEmail(requestData.email)) {
        res.status(400).json({ success: false, message: 'Invalid email address.', reason: 'email' });
        return;
    }
    ;
    if (!userValidation.isValidDisplayName(requestData.displayName)) {
        res.status(400).json({ success: false, message: 'Invalid display name.', reason: 'displayName' });
        return;
    }
    ;
    if (!userValidation.isValidUsername(requestData.username)) {
        res.status(400).json({ success: false, message: 'Invalid username.', reason: 'username' });
        return;
    }
    ;
    if (!userValidation.isValidNewPassword(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.', reason: 'password' });
        return;
    }
    ;
    if (requestData.username === requestData.password) {
        res.status(409).json({ success: false, message: `Password can't be identical to username.`, reason: 'passwordEqualsUsername' });
        return;
    }
    ;
    const existingAuthSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (existingAuthSessionId) {
        res.status(403).json({ success: false, message: 'You must sign out before creating a new account.', reason: 'signedIn' });
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
      (SELECT 2 AS taken_status FROM accounts WHERE username = :username LIMIT 1);`, { email: requestData.email, username: requestData.username });
        if (emailUsernameRows.length > 0) {
            await connection.rollback();
            const takenDataSet = new Set();
            emailUsernameRows.forEach((row) => takenDataSet.add(row.taken_status));
            if (takenDataSet.has(1) && takenDataSet.has(2)) {
                res.status(409).json({
                    success: false,
                    message: 'Email address and username are both already taken.',
                    reason: 'emailAndUsernameTaken',
                });
                return;
            }
            ;
            if (takenDataSet.has(1)) {
                res.status(409).json({ success: false, message: 'Email address is already taken.', reason: 'emailTaken' });
                return;
            }
            ;
            if (takenDataSet.has(2)) {
                res.status(409).json({ success: false, message: 'Username is already taken.', reason: 'usernameTaken' });
                return;
            }
            ;
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const verificationCode = (0, tokenGenerator_1.generateUniqueCode)();
        const hashedPassword = await bcrypt_1.default.hash(requestData.password, 10);
        const createdOnTimestamp = Date.now();
        const [resultSetHeader] = await connection.execute(`INSERT INTO accounts(
        email,
        hashed_password,
        username,
        display_name,
        created_on_timestamp,
        is_verified,
        failed_sign_in_attempts,
        marked_for_deletion
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(8)});`, [requestData.email, hashedPassword, requestData.username, requestData.displayName, createdOnTimestamp, false, 0, false]);
        const accountId = resultSetHeader.insertId;
        await connection.execute(`INSERT INTO account_verification(
        account_id,
        verification_code,
        verification_emails_sent,
        failed_verification_attempts,
        created_on_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [accountId, verificationCode, 1, 0, createdOnTimestamp]);
        await connection.commit();
        res.status(201).json({ success: true, resData: { accountId, createdOnTimestamp } });
        await (0, emailServices_1.sendVerificationEmail)({
            to: requestData.email,
            accountId,
            verificationCode,
            displayName: requestData.displayName,
            createdOnTimestamp
        });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const sqlError = err;
        if (sqlError.errno === 1062 && sqlError.sqlMessage?.endsWith(`for key 'email'`)) {
            res.status(409).json({ success: false, message: 'Email address is already taken.', reason: 'emailTaken' });
            return;
        }
        ;
        if (sqlError.errno === 1062 && sqlError.sqlMessage?.endsWith(`for key 'username'`)) {
            res.status(409).json({ success: false, message: 'Username is already taken.', reason: 'usernameTaken' });
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
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
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountId)) {
        res.status(400).json({ success: false, message: 'Invalid account ID.', reason: 'accountId' });
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
        account_verification.created_on_timestamp
      FROM
        accounts
      LEFT JOIN
        account_verification ON accounts.account_id = account_verification.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`, [requestData.accountId]);
        if (accountRows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const accountDetails = accountRows[0];
        if (accountDetails.is_verified) {
            res.status(409).json({ success: false, message: 'Account already verified.', reason: 'alreadyVerified' });
            return;
        }
        ;
        if (!accountDetails.verification_id) {
            res.status(404).json({ success: false, message: 'Verification request not found.' });
            return;
        }
        ;
        if (accountDetails.verification_emails_sent >= 3) {
            res.status(403).json({ success: false, message: 'Verification emails limit reached.', reason: 'limitReached' });
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
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: { verificationEmailsSent: accountDetails.verification_emails_sent } });
        await (0, emailServices_1.sendVerificationEmail)({
            to: accountDetails.email,
            accountId: requestData.accountId,
            verificationCode: accountDetails.verification_code,
            displayName: accountDetails.display_name,
            createdOnTimestamp: accountDetails.created_on_timestamp,
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.patch('/verification/verify', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['accountId', 'verificationCode'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountId)) {
        res.status(400).json({ success: false, message: 'Invalid account ID.', reason: 'accountId' });
        return;
    }
    ;
    if (!userValidation.isValidCode(requestData.verificationCode)) {
        res.status(400).json({ success: false, message: 'Invalid verification code.', reason: 'verificationCode' });
        return;
    }
    ;
    const existingAuthSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (existingAuthSessionId) {
        res.status(403).json({ success: false, message: 'You must sign out before proceeding.', reason: 'signedIn' });
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
        if (accountRows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const accountDetails = accountRows[0];
        if (accountDetails.is_verified) {
            res.status(409).json({ success: false, message: 'Account already verified.' });
            return;
        }
        ;
        const isCorrectVerificationCode = requestData.verificationCode == accountDetails.verification_code;
        if (!isCorrectVerificationCode) {
            if (accountDetails.failed_verification_attempts + 1 >= 3) {
                await db_1.dbPool.execute(`DELETE FROM
            accounts
          WHERE
            account_id = ?;`, [requestData.accountId]);
                res.status(401).json({ success: false, message: 'Incorrect verification code.', reason: 'accountDeleted' });
                return;
            }
            ;
            await db_1.dbPool.execute(`UPDATE
          account_verification
        SET
          failed_verification_attempts = failed_verification_attempts + 1
        WHERE
          verification_id = ?;`, [accountDetails.verification_id]);
            res.status(401).json({ success: false, message: 'Incorrect verification code.' });
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
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const [secondResultSetHeader] = await connection.execute(`DELETE FROM
        account_verification
      WHERE
        verification_id = ?;`, [accountDetails.verification_id]);
        if (secondResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: requestData.accountId,
            user_type: 'account',
            keepSignedIn: false,
        });
        res.json({ success: true, resData: { authSessionCreated } });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
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
    if (!userValidation.isValidEmail(requestData.email)) {
        res.status(400).json({ success: false, message: 'Invalid email address.', reason: 'email' });
        return;
    }
    ;
    if (!userValidation.isValidPassword(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid account password.', reason: 'password' });
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
        failed_sign_in_attempts,
        marked_for_deletion
      FROM
        accounts
      WHERE
        email = ?
      LIMIT 1;`, [requestData.email]);
        if (accountRows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const accountDetails = accountRows[0];
        if (accountDetails.marked_for_deletion) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        if (accountDetails.failed_sign_in_attempts >= 5) {
            res.status(403).json({ success: false, message: 'Account locked.', reason: 'accountLocked' });
            return;
        }
        ;
        if (!accountDetails.is_verified) {
            res.status(403).json({ success: false, message: 'Account unverified.', reason: 'unverified' });
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
            res.status(500).json({ success: false, message: 'Internal server error.' });
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
exports.accountsRouter.post('/recovery/sendEmail', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['email'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidEmail(requestData.email)) {
        res.status(400).json({ success: false, message: 'Invalid email address.', reason: 'email' });
        return;
    }
    ;
    const existingAuthSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (existingAuthSessionId) {
        res.status(403).json({ success: false, message: `Can't recover account while signed in.`, reason: 'signedIn' });
        return;
    }
    ;
    try {
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.account_id,
        accounts.display_name,
        accounts.is_verified,
        accounts.marked_for_deletion,
        account_recovery.recovery_id,
        account_recovery.recovery_token,
        account_recovery.request_timestamp,
        account_recovery.recovery_emails_sent,
        account_recovery.failed_recovery_attempts
      FROM
        accounts
      LEFT JOIN
        account_recovery ON accounts.account_id = account_recovery.account_id
      WHERE
        accounts.email = ?
      LIMIT 1;`, [requestData.email]);
        if (accountRows.length === 0) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        const accountDetails = accountRows[0];
        if (accountDetails.marked_for_deletion) {
            res.status(404).json({ success: false, message: 'Account not found.' });
            return;
        }
        ;
        if (!accountDetails.is_verified) {
            res.status(403).json({ success: false, message: 'Account unverified.', reason: 'unverified' });
            return;
        }
        ;
        if (!accountDetails.recovery_id) {
            const recoveryToken = (0, tokenGenerator_1.generateUniqueToken)();
            const requestTimestamp = Date.now();
            await db_1.dbPool.execute(`INSERT INTO account_recovery(
          account_id,
          recovery_token,
          request_timestamp,
          recovery_emails_sent,
          failed_recovery_attempts
        )
        VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [accountDetails.account_id, recoveryToken, requestTimestamp, 1, 0]);
            res.json({ success: true, resData: { requestTimestamp } });
            await (0, emailServices_1.sendRecoveryEmail)({
                to: requestData.email,
                accountId: accountDetails.account_id,
                recoveryToken,
                requestTimestamp,
                displayName: accountDetails.display_name,
            });
            return;
        }
        ;
        if (accountDetails.recovery_emails_sent >= 3) {
            res.status(403).json({
                success: false,
                message: 'Recovery email limit has been reached.',
                reason: 'emailLimitReached',
                resData: {
                    requestTimestamp: accountDetails.request_timestamp,
                },
            });
            return;
        }
        ;
        if (accountDetails.failed_recovery_attempts >= 3) {
            res.status(403).json({
                success: false,
                message: 'Too many failed recovery attempts.',
                reason: 'failureLimitReached',
                resData: {
                    requestTimestamp: accountDetails.request_timestamp,
                },
            });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        account_recovery
      SET
        recovery_emails_sent = recovery_emails_sent + 1
      WHERE
        recovery_id = ?;`, [accountDetails.recovery_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: { requestTimestamp: accountDetails.request_timestamp } });
        await (0, emailServices_1.sendRecoveryEmail)({
            to: requestData.email,
            accountId: accountDetails.account_id,
            recoveryToken: accountDetails.recovery_token,
            requestTimestamp: accountDetails.request_timestamp,
            displayName: accountDetails.display_name,
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.patch('/recovery/updatePassword', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['accountId', 'recoveryToken', 'newPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountId)) {
        res.status(400).json({ success: false, message: 'Invalid account ID.', reason: 'accountId' });
        return;
    }
    ;
    if (!userValidation.isValidUniqueToken(requestData.recoveryToken)) {
        res.status(400).json({ success: false, message: 'Invalid recovery token.', reason: 'recoveryToken' });
        return;
    }
    ;
    if (!userValidation.isValidNewPassword(requestData.newPassword)) {
        res.status(400).json({ success: false, message: 'Invalid new password.', reason: 'password' });
        return;
    }
    ;
    const existingAuthSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (existingAuthSessionId) {
        res.status(403).json({ success: false, message: `Can't recover account while signed in.`, reason: 'signedIn' });
        return;
    }
    ;
    try {
        ;
        const [recoveryRows] = await db_1.dbPool.execute(`SELECT
        recovery_id,
        recovery_token,
        failed_recovery_attempts,
        request_timestamp,
        (SELECT username FROM accounts WHERE account_id = :accountId) AS username
      FROM
        account_recovery
      WHERE
        account_id = :accountId
      LIMIT 1;`, { accountId: requestData.accountId });
        if (recoveryRows.length === 0) {
            res.status(404).json({ success: false, message: 'Recovery request not found or has expired.' });
            return;
        }
        ;
        const recoveryDetails = recoveryRows[0];
        if (recoveryDetails.failed_recovery_attempts >= 3) {
            res.status(403).json({
                success: false,
                message: 'Too many failed recovery attempts.',
                reason: 'failureLimitReached',
                resData: {
                    requestTimestamp: recoveryDetails.request_timestamp,
                },
            });
            return;
        }
        ;
        if (requestData.recoveryToken !== recoveryDetails.recovery_token) {
            await db_1.dbPool.execute(`UPDATE
          account_recovery
        SET
          failed_recovery_attempts = failed_recovery_attempts + 1
        WHERE
          recovery_id = ?;`, [recoveryDetails.recovery_id]);
            if (recoveryDetails.failed_recovery_attempts + 1 >= 3) {
                res.status(401).json({
                    success: false,
                    message: 'Incorrect recovery token. Recovery suspended',
                    reason: 'recoverySuspended',
                    requestData: {
                        requestTimestamp: recoveryDetails.request_timestamp,
                    },
                });
                return;
            }
            ;
            res.status(401).json({ success: false, message: 'Incorrect recovery token.', reason: 'incorrectRecoveryToken' });
            return;
        }
        ;
        if (recoveryDetails.username === requestData.newPassword) {
            res.status(409).json({ success: false, message: `New password can't be identical to username.` });
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
            res.status(500).json({ success: false, message: 'Internal server error.' });
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
        res.json({ success: true, resData: { authSessionCreated } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.delete(`/deletion/start`, async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['password'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidPassword(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
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
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)('authSessionId');
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        email,
        hashed_password,
        display_name,
        failed_sign_in_attempts,
      FROM
        accounts
      WHERE
        account_id = ?;`, [authSessionDetails.user_id]);
        if (accountRows.length === 0) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const accountDetails = accountRows[0];
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, accountDetails.hashed_password);
        if (!isCorrectPassword) {
            await (0, accountServices_1.handleIncorrectAccountPassword)(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await connection.beginTransaction();
        ;
        const [hangoutRows] = await connection.execute(`SELECT
        hangouts.hangout_id,
        hangouts.current_step,
        hangout_members.hangout_member_id
      FROM
        hangouts
      INNER JOIN
        hangout_members ON hangouts.hangout_id = hangout_members.hangout_id
      WHERE
        hangout_members.account_id = ?;`, [authSessionDetails.user_id]);
        if (hangoutRows.length > 0) {
            const hangoutsInVotingStep = hangoutRows.filter((hangout) => hangout.current_step === 3);
            if (hangoutsInVotingStep.length > 0) {
                const hangoutMemberIds = hangoutsInVotingStep.map((hangout) => hangout.hangout_member_id);
                const [resultSetHeader] = await connection.execute(`DELETE FROM
            votes
          WHERE
            hangout_member_id IN (${hangoutMemberIds.join(', ')})
          LIMIT ${hangoutMemberIds.length};`);
                if (resultSetHeader.affectedRows !== hangoutMemberIds.length) {
                    await connection.rollback();
                    res.status(500).json({ success: false, message: 'Internal server error.' });
                    return;
                }
                ;
            }
            ;
            const hangoutMemberIds = hangoutRows.map((hangout) => hangout.hangout_member_id);
            const [resultSetHeader] = await connection.execute(`DELETE FROM
          hangout_members
        WHERE
          hangout_member_id IN (${hangoutMemberIds.join(', ')})
        LIMIT ${hangoutMemberIds.length};`);
            if (resultSetHeader.affectedRows !== hangoutMemberIds.length) {
                await connection.rollback();
                res.status(500).json({ success: false, message: 'Internal server error.' });
                return;
            }
            ;
        }
        ;
        const [resultSetHeader] = await connection.execute(`UPDATE
        accounts
      SET
        marked_for_deletion = ?
      WHERE
        account_id = ?;`, [true, authSessionDetails.user_id]);
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const cancellationToken = (0, tokenGenerator_1.generateUniqueToken)();
        await connection.execute(`INSERT INTO account_deletion(
        account_id,
        cancellation_token,
        request_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [authSessionDetails.user_id, cancellationToken, Date.now()]);
        const eventDescription = `${accountDetails.display_name} has left the hangout.`;
        const currentTimestamp = Date.now();
        let eventValues = '';
        for (const hangout of hangoutRows) {
            eventValues += `('${hangout.hangout_id}', '${eventDescription})', ${currentTimestamp}),`;
        }
        ;
        eventValues.slice(0, -1);
        await connection.execute(`INSERT INTO hangout_events(
        hangout_id,
        event_description,
        event_timestamp
      )
      VALUES(${eventValues});`);
        await connection.commit();
        await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'account');
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(202).json({ success: true, resData: {} });
        await (0, emailServices_1.sendDeletionEmail)({
            to: accountDetails.email,
            accountId: authSessionDetails.user_id,
            cancellationToken,
            displayName: accountDetails.display_name,
        });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
exports.accountsRouter.patch('/deletion/cancel', async (req, res) => {
    ;
    const requestData = req.body;
    const expectedKeys = ['cancellationToken', 'accountId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.accountId)) {
        res.status(400).json({ succesS: false, message: 'Invalid account ID.' });
        return;
    }
    ;
    if (!userValidation.isValidUniqueToken(requestData.cancellationToken)) {
        res.status(400).json({ success: false, message: 'Invalid cancellation token.' });
        return;
    }
    ;
    let connection;
    try {
        ;
        const [deletionRows] = await db_1.dbPool.execute(`SELECT
        deletion_id,
        cancellation_token
      FROM
        account_deletion
      WHERE
        account_id = ?
      LIMIT 1;`, [requestData.accountId]);
        if (deletionRows.length === 0) {
            res.status(404).json({ success: false, message: 'Deletion request not found.' });
            return;
        }
        ;
        const deletionDetails = deletionRows[0];
        if (requestData.cancellationToken !== deletionDetails.cancellation_token) {
            res.status(401).json({ success: false, message: 'Incorrect cancellation token.' });
            return;
        }
        ;
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        const [firstResultSetHeader] = await connection.execute(`UPDATE
        accounts
      SET
        marked_for_deletion = ?
      WHERE
        account_id = ?;`, [false, requestData.accountId]);
        if (firstResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const [secondResultSetHeader] = await connection.execute(`DELETE FROM
        account_deletion
      WHERE
        deletion_id = ?;`, [deletionDetails.deletion_id]);
        if (secondResultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });
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
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['currentPassword', 'newPassword'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidPassword(requestData.currentPassword)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    if (!userValidation.isValidNewPassword(requestData.newPassword)) {
        res.status(400).json({ success: false, message: 'Invalid new password.' });
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
        accounts
      WHERE
        session_id = ?;`, [authSessionId]);
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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
        if (accountRows.length === 0) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const accountDetails = accountRows[0];
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.currentPassword, accountDetails.hashed_password);
        if (!isCorrectPassword) {
            await (0, accountServices_1.handleIncorrectAccountPassword)(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
            return;
        }
        ;
        const areIdenticalPasswords = await bcrypt_1.default.compare(requestData.newPassword, accountDetails.hashed_password);
        if (areIdenticalPasswords) {
            res.status(409).json({
                success: false,
                message: `New password can't be identical to current password.`,
                reason: 'identicalPasswords'
            });
            return;
        }
        ;
        if (accountDetails.username === requestData.newPassword) {
            res.status(409).json({ success: false, message: `New password can't be identical to username.`, reason: 'passwordEqualsUsername' });
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
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'account');
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: authSessionDetails.user_id,
            user_type: 'account',
            keepSignedIn: false,
        });
        res.json({ success: true, resData: { authSessionCreated } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.post('/details/updateEmail/start', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['password', 'newEmail'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidEmail(requestData.newEmail)) {
        res.status(400).json({ success: false, message: 'Invalid email address.' });
        return;
    }
    ;
    if (!userValidation.isValidPassword(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
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
        session_id = ?`, [authSessionId]);
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.hashed_password,
        accounts.email,
        accounts.display_name,
        accounts.failed_sign_in_attempts,
        email_update.update_id,
        email_update.new_email,
        email_update.verification_code,
        email_update.request_timestamp,
        email_update.update_emails_sent,
        email_update.failed_update_attempts
      FROM
        accounts
      LEFT JOIN
        email_update ON accounts.account_id = email_update.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`, [authSessionDetails.user_id]);
        const accountDetails = accountRows[0];
        if (accountRows.length === 0) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, accountDetails.hashed_password);
        if (!isCorrectPassword) {
            await (0, accountServices_1.handleIncorrectAccountPassword)(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
            return;
        }
        ;
        if (requestData.newEmail === accountDetails.email) {
            res.status(409).json({ success: false, message: `New email can't be identical to current email.` });
            return;
        }
        ;
        if (!accountDetails.update_id) {
            connection = await db_1.dbPool.getConnection();
            await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
            await connection.beginTransaction();
            const [emailRows] = await connection.execute(`(SELECT 1 FROM accounts WHERE email = :newEmail LIMIT 1)
        UNION ALL
        (SELECT 1 FROM email_update WHERE new_email = :newEmail LIMIT 1);`, { newEmail: requestData.newEmail });
            if (emailRows.length > 0) {
                await connection.rollback();
                res.status(409).json({ success: false, message: 'Email is already taken.' });
                return;
            }
            ;
            const newVerificationCode = (0, tokenGenerator_1.generateUniqueCode)();
            await connection.execute(`INSERT INTO email_update(
          account_id,
          new_email,
          verification_code,
          request_timestamp,
          update_emails_sent,
          failed_update_attempts
        )
        VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(6)});`, [authSessionDetails.user_id, requestData.newEmail, newVerificationCode, Date.now(), 1, 0]);
            await connection.commit();
            res.json({ success: true, resData: {} });
            await (0, emailServices_1.sendEmailUpdateEmail)({
                to: requestData.newEmail,
                verificationCode: newVerificationCode,
                displayName: accountDetails.display_name,
            });
            return;
        }
        ;
        if (accountDetails.failed_update_attempts >= 3) {
            const { hoursRemaining, minutesRemaining } = userUtils.getTimeTillNextRequest(accountDetails.request_timestamp, 'day');
            res.status(403).json({
                success: false,
                message: 'Too many failed attempts.',
                resData: {
                    hoursRemaining,
                    minutesRemaining: minutesRemaining || 1,
                },
            });
            return;
        }
        ;
        if (requestData.newEmail !== accountDetails.new_email) {
            res.status(409).json({ success: false, message: 'Ongoing request contains a different new email address.' });
            return;
        }
        ;
        if (accountDetails.update_emails_sent >= 3) {
            res.status(403).json({ success: false, message: 'Update email limit reached.' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        email_update
      SET
        update_emails_sent = update_emails_sent + 1
      WHERE
        update_id = ?;`, [accountDetails.update_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        res.json({ success: true, resData: {} });
        await (0, emailServices_1.sendEmailUpdateEmail)({
            to: requestData.newEmail,
            verificationCode: accountDetails.verification_code,
            displayName: accountDetails.display_name,
        });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
exports.accountsRouter.patch('/details/updateEmail/confirm', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['verificationCode'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidCode(requestData.verificationCode)) {
        res.status(400).json({ success: false, message: 'Invalid verification code.' });
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
        sessions_id = ?;`, [authSessionId]);
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [accountRows] = await db_1.dbPool.execute(`SELECT
        accounts.display_name,
        accounts.email,
        email_update.update_id,
        email_update.new_email,
        email_update.verification_code,
        email_update.request_timestamp,
        email_update.failed_update_attempts
      FROM
        accounts
      LEFT JOIN
        email_update ON accounts.account_id = email_update.account_id
      WHERE
        accounts.account_id = ?
      LIMIT 1;`, [authSessionDetails.user_id]);
        if (accountRows.length === 0) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const accountDetails = accountRows[0];
        if (!accountDetails.update_id) {
            res.status(404).json({ success: false, message: 'Email update request not found.' });
            return;
        }
        ;
        if (accountDetails.failed_update_attempts >= 3) {
            const { hoursRemaining, minutesRemaining } = userUtils.getTimeTillNextRequest(accountDetails.request_timestamp, 'day');
            res.status(403).json({
                success: false,
                message: 'Too many failed attempts.',
                resData: {
                    hoursRemaining,
                    minutesRemaining: minutesRemaining || 1,
                },
            });
            return;
        }
        ;
        if (requestData.verificationCode !== accountDetails.verification_code) {
            const requestSuspended = accountDetails.failed_update_attempts + 1 >= 3;
            const resetRequestTimestamp = requestSuspended ? `, request_timestamp = ${Date.now()}` : '';
            await db_1.dbPool.execute(`UPDATE
            email_update
          SET
            failed_update_attempts = failed_update_attempts + 1
            ${resetRequestTimestamp}
          WHERE
            update_id = ?;`, [Date.now(), accountDetails.update_id]);
            if (requestSuspended) {
                await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'account');
                (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            }
            ;
            res.status(401).json({
                success: false,
                message: `Incorrect verification code.${requestSuspended ? 'Request suspended.' : ''}`,
                reason: requestSuspended ? 'requestSuspended' : undefined,
            });
            if (requestSuspended) {
                await (0, emailServices_1.sendEmailUpdateWarningEmail)(accountDetails.email, accountDetails.display_name);
            }
            ;
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`UPDATE
        accounts
      SET
        email = ?
      WHERE
        account_id = ?;`, [accountDetails.new_email, authSessionDetails.user_id]);
        if (resultSetHeader.affectedRows === 0) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await (0, authSessions_1.purgeAuthSessions)(authSessionDetails.user_id, 'account');
        const authSessionCreated = await (0, authSessions_1.createAuthSession)(res, {
            user_id: authSessionDetails.user_id,
            user_type: 'account',
            keepSignedIn: false,
        });
        res.json({ success: true, resData: { authSessionCreated } });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.patch('/details/updateDisplayName', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['password', 'newDisplayName'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidPassword(requestData.password)) {
        res.status(400).json({ success: false, message: 'Invalid password.' });
        return;
    }
    ;
    let connection;
    if (!userValidation.isValidDisplayName(requestData.newDisplayName)) {
        res.status(400).json({ success: false, message: 'Invalid display name.' });
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
        session_id = ?:`, [authSessionId]);
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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
        if (accountRows.length === 0) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Invalid credentials. Request denied.' });
            return;
        }
        ;
        const accountDetails = accountRows[0];
        const isCorrectPassword = await bcrypt_1.default.compare(requestData.password, accountDetails.hashed_password);
        if (!isCorrectPassword) {
            await (0, accountServices_1.handleIncorrectAccountPassword)(res, authSessionDetails.user_id, accountDetails.failed_sign_in_attempts);
            return;
        }
        ;
        if (requestData.newDisplayName === accountDetails.display_name) {
            res.status(409).json({ success: false, message: `New display name can't be identical to current display name` });
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
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.execute(`UPDATE
        hangout_members
      SET
        display_name = ?
      WHERE
        account_id = ?;`, [requestData.newDisplayName]);
        await connection.commit();
        res.json({ success: true, resData: { newDisplayName: requestData.newDisplayName } });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
exports.accountsRouter.post('/friends/requests/send', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['requesteeUsername'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!userValidation.isValidUsername(requestData.requesteeUsername)) {
        res.status(400).json({ success: false, message: 'Invalid requestee username.' });
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
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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
      LIMIT 1;`, [requestData.requesteeUsername, authSessionDetails.user_id]);
        if (requesteeRows.length === 0) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        ;
        const requesteeId = requesteeRows[0].requestee_id;
        if (requesteeId === authSessionDetails.user_id) {
            res.status(409).json({ success: false, message: 'Can not add yourself as a friend.' });
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
        const alreadyFriends = friendshipRows[0][0].already_friends === 1;
        const requestAlreadySent = friendshipRows[1][0].request_already_sent === 1;
        if (alreadyFriends) {
            res.status(409).json({ success: false, message: 'Already friends.' });
            return;
        }
        ;
        if (requestAlreadySent) {
            res.status(409).json({ success: false, message: 'Friend request already sent.' });
            return;
        }
        ;
        await db_1.dbPool.execute(`INSERT INTO friend_requests(
        requester_id,
        requestee_id,
        request_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [authSessionDetails.user_id, requesteeId, Date.now()]);
        res.json({ success: true, resData: {} });
        return;
    }
    catch (err) {
        console.log(err);
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        if (err.errno === 1062) {
            res.status(409).json({ success: false, message: 'Friend request already sent.' });
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    ;
});
exports.accountsRouter.post('/friends/requests/accept', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['friendRequestId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.friendRequestId)) {
        res.status(400).json({ success: false, message: 'Invalid friend request ID.' });
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
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
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
        if (friendRequestRows.length === 0) {
            res.status(404).json({ success: false, message: 'Friend request not found.' });
            return;
        }
        ;
        const requesterId = friendRequestRows[0].requester_id;
        const friendshipTimestamp = Date.now();
        connection = await db_1.dbPool.getConnection();
        await connection.beginTransaction();
        await connection.execute(`INSERT INTO friendships(
        first_account_id,
        second_account_id,
        friendship_timestamp
      )
      VALUES(${(0, generatePlaceHolders_1.generatePlaceHolders)(3)});`, [authSessionDetails.user_id, requesterId, friendshipTimestamp]);
        const [resultSetHeader] = await connection.execute(`DELETE FROM
        friend_requests
      WHERE
        (requester_id = :requesterId AND requestee_id = :accountId) OR
        (requester_id = :accountId AND requestee_id = :requesterId)
      LIMIT 2;`, { accountId: authSessionDetails.user_id, requesterId });
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        await connection.commit();
        res.json({ success: true, resData: {} });
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        if (!(0, isSqlError_1.isSqlError)(err)) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
            return;
        }
        ;
        const sqlError = err;
        if (sqlError.errno === 1062) {
            res.status(409).json({ success: false, message: 'Already friends.' });
            return;
        }
        ;
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    finally {
        connection?.release();
    }
    ;
});
exports.accountsRouter.delete('/friends/requests/decline', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['friendRequestId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.friendRequestId)) {
        res.status(400).json({ success: false, message: 'Invalid friend request ID.' });
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
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        friend_requests
      WHERE
        request_id = ?;`, [requestData.friendRequestId]);
        if (resultSetHeader.affectedRows === 0) {
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
exports.accountsRouter.delete('/friends/manage/remove', async (req, res) => {
    ;
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    if (!authUtils.isValidAuthSessionId(authSessionId)) {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
        res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
        return;
    }
    ;
    const requestData = req.body;
    const expectedKeys = ['friendshipId'];
    if ((0, requestValidation_1.undefinedValuesDetected)(requestData, expectedKeys)) {
        res.status(400).json({ success: false, message: 'Invalid request data.' });
        return;
    }
    ;
    if (!Number.isInteger(requestData.friendshipId)) {
        res.status(400).json({ success: false, message: 'Invalid friendship ID.' });
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
        if (authSessionRows.length === 0) {
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        const authSessionDetails = authSessionRows[0];
        if (!authUtils.isValidAuthSessionDetails(authSessionDetails, 'account')) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId', true);
            res.status(401).json({ success: false, message: 'Sign in session expired.', reason: 'authSessionExpired' });
            return;
        }
        ;
        ;
        const [friendshipRows] = await db_1.dbPool.execute(`SELECT
        friend_id
      FROM
        friendships
      WHERE
        friendship_id = ?;`, [requestData.friendshipId]);
        if (friendshipRows.length === 0) {
            res.status(404).json({ success: false, message: 'Friend not found.' });
            return;
        }
        ;
        const friendId = friendshipRows[0].friend_id;
        const [resultSetHeader] = await db_1.dbPool.execute(`DELETE FROM
        friendships
      WHERE
        (account_id = :accountId AND friend_id = :friendId) OR
        (account_id = :friendId AND friend_id = :accountId)
      LIMIT 2;`, { accountId: authSessionDetails.user_id, friendId });
        if (resultSetHeader.affectedRows !== 2) {
            res.status(500).json({ success: false, message: 'Internal server error.' });
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