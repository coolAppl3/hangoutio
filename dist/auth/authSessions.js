"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purgeAuthSessions = exports.destroyAuthSession = exports.createAuthSession = void 0;
const db_1 = require("../db/db");
const tokenGenerator_1 = require("../util/tokenGenerator");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
const isSqlError_1 = require("../util/isSqlError");
const cookieUtils_1 = require("../util/cookieUtils");
const constants_1 = require("../util/constants");
const authSessionLimit = 3;
;
async function createAuthSession(res, sessionConfig, attemptCount = 1) {
    if (attemptCount > 3) {
        return false;
    }
    ;
    const newAuthSessionId = (0, tokenGenerator_1.generateAuthSessionId)();
    const currentTimestamp = Date.now();
    const maxAge = sessionConfig.keepSignedIn ? constants_1.hourMilliseconds * 24 * 7 : constants_1.hourMilliseconds * 6;
    const expiryTimestamp = currentTimestamp + maxAge;
    let connection;
    try {
        connection = await db_1.dbPool.getConnection();
        await connection.execute(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`);
        await connection.beginTransaction();
        ;
        const [sessionRows] = await connection.execute(`SELECT
        session_id,
        created_on_timestamp
      FROM
        auth_sessions
      WHERE
        user_id = ? AND
        user_type = ?
      LIMIT ${authSessionLimit};`, [sessionConfig.user_id, sessionConfig.user_type]);
        if (sessionRows.length < 3) {
            await connection.execute(`INSERT INTO auth_sessions (
          session_id,
          user_id,
          user_type,
          created_on_timestamp,
          expiry_timestamp
        ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [newAuthSessionId, sessionConfig.user_id, sessionConfig.user_type, currentTimestamp, expiryTimestamp]);
            await connection.commit();
            (0, cookieUtils_1.setResponseCookie)(res, 'authSessionId', newAuthSessionId, maxAge, true);
            (0, cookieUtils_1.setResponseCookie)(res, 'signedInAs', sessionConfig.user_type, maxAge, false);
            return true;
        }
        ;
        const oldestAuthSession = sessionRows.sort((a, b) => a.created_on_timestamp - b.created_on_timestamp)[0];
        const [resultSetHeader] = await connection.execute(`UPDATE
        auth_sessions
      SET
        session_id = ?,
        created_on_timestamp = ?,
        expiry_timestamp = ?
      WHERE
        session_id = ?;`, [newAuthSessionId, currentTimestamp, expiryTimestamp, oldestAuthSession.session_id]);
        if (resultSetHeader.affectedRows === 0) {
            await connection.rollback();
            return false;
        }
        ;
        await connection.commit();
        (0, cookieUtils_1.setResponseCookie)(res, 'authSessionId', newAuthSessionId, maxAge, true);
        (0, cookieUtils_1.setResponseCookie)(res, 'signedInAs', sessionConfig.user_type, maxAge, false);
        return true;
    }
    catch (err) {
        console.log(err);
        await connection?.rollback();
        if (!(0, isSqlError_1.isSqlError)(err)) {
            return false;
        }
        ;
        if (err.errno === 1062 && err.sqlMessage?.endsWith(`for key 'PRIMARY'`)) {
            return await createAuthSession(res, sessionConfig, ++attemptCount);
        }
        ;
        return false;
    }
    finally {
        connection?.release();
    }
    ;
}
exports.createAuthSession = createAuthSession;
;
async function destroyAuthSession(sessionId) {
    try {
        await db_1.dbPool.execute(`DELETE FROM
        auth_sessions
      WHERE
        session_id = ?;`, [sessionId]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.destroyAuthSession = destroyAuthSession;
;
async function purgeAuthSessions(userId, userType) {
    try {
        await db_1.dbPool.execute(`DELETE FROM
        auth_sessions
      WHERE
        user_id = ? AND
        user_type = ?
      LIMIT ${authSessionLimit};`, [userId, userType]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.purgeAuthSessions = purgeAuthSessions;
;
