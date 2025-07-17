"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateHandshake = exports.handleWebSocketUpgrade = void 0;
const http_1 = __importDefault(require("http"));
const db_1 = require("../../db/db");
const authUtils_1 = require("../../auth/authUtils");
const authSessions_1 = require("../../auth/authSessions");
const hangoutValidation_1 = require("../../util/validation/hangoutValidation");
const hangoutWebSocketServer_1 = require("./hangoutWebSocketServer");
async function handleWebSocketUpgrade(req, socket, head) {
    socket.on('error', (err) => {
        if (('errno' in err) && err.errno === -4077) {
            socket.end();
            return;
        }
        ;
        console.log(err, err.stack);
        socket.write(`HTTP/1.1 ${http_1.default.STATUS_CODES[500]}\r\n\r\n`);
        socket.write('Internal server error\r\n');
        socket.end();
    });
    const memoryUsageMegabytes = process.memoryUsage().rss / Math.pow(1024, 2);
    const memoryThreshold = +(process.env.WS_ALLOW_MEMORY_THRESHOLD_MB || 500);
    if (memoryUsageMegabytes >= memoryThreshold) {
        socket.write(`HTTP/1.1 ${http_1.default.STATUS_CODES[509]}\r\n\r\n`);
        socket.write('Temporarily unavailable\r\n');
        socket.end();
        return;
    }
    ;
    const webSocketDetails = await authenticateHandshake(req);
    if (!webSocketDetails) {
        socket.write(`HTTP/1.1 ${http_1.default.STATUS_CODES[401]}\r\n\r\n`);
        socket.write('Invalid credentials\r\n');
        socket.end();
        return;
    }
    ;
    hangoutWebSocketServer_1.wss.handleUpgrade(req, socket, head, (ws) => {
        const wsSet = hangoutWebSocketServer_1.wsMap.get(webSocketDetails.hangoutId);
        if (!wsSet) {
            hangoutWebSocketServer_1.wsMap.set(webSocketDetails.hangoutId, new Set([ws]));
            hangoutWebSocketServer_1.wss.emit('connection', ws, req);
            return;
        }
        ;
        wsSet.add(ws);
        hangoutWebSocketServer_1.wss.emit('connection', ws, req);
    });
}
exports.handleWebSocketUpgrade = handleWebSocketUpgrade;
;
async function authenticateHandshake(req) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
        return null;
    }
    ;
    const cookieHeaderArr = cookieHeader.split('; ');
    let authSessionId = null;
    for (const cookie of cookieHeaderArr) {
        const [cookieName, cookieValue] = cookie.split('=');
        if (!cookieName || !cookieValue) {
            continue;
        }
        ;
        if (cookieName === 'authSessionId' && (0, authUtils_1.isValidAuthSessionId)(cookieValue)) {
            authSessionId = cookieValue;
            break;
        }
        ;
    }
    ;
    if (!authSessionId) {
        return null;
    }
    ;
    if (!req.url) {
        return null;
    }
    ;
    const url = new URL(req.url, `https://${req.headers.host}`);
    const hangoutMemberId = url.searchParams.get('hangoutMemberId');
    const hangoutId = url.searchParams.get('hangoutId');
    if (!hangoutMemberId || !Number.isInteger(+hangoutMemberId)) {
        return null;
    }
    ;
    if (!hangoutId || !(0, hangoutValidation_1.isValidHangoutId)(hangoutId)) {
        return null;
    }
    ;
    if (!(await isValidUserData(authSessionId, +hangoutMemberId, hangoutId))) {
        return null;
    }
    ;
    return { hangoutMemberId: +hangoutMemberId, hangoutId };
}
exports.authenticateHandshake = authenticateHandshake;
;
async function isValidUserData(authSessionId, hangoutMemberId, hangoutId) {
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
            return false;
        }
        ;
        if (!(0, authUtils_1.isValidAuthSessionDetails)(authSessionDetails)) {
            await (0, authSessions_1.destroyAuthSession)(authSessionId);
            return false;
        }
        ;
        ;
        const [hangoutMemberRows] = await db_1.dbPool.execute(`SELECT
        hangout_id,
        account_id,
        guest_id
      FROM
        hangout_members
      WHERE
        hangout_member_id = ?;`, [hangoutMemberId]);
        const hangoutMemberDetails = hangoutMemberRows[0];
        if (!hangoutMemberDetails) {
            return false;
        }
        ;
        if (hangoutMemberDetails[`${authSessionDetails.user_type}_id`] !== authSessionDetails.user_id) {
            return false;
        }
        ;
        if (hangoutMemberDetails.hangout_id !== hangoutId) {
            return false;
        }
        ;
        return true;
    }
    catch (err) {
        console.log(err);
        return false;
    }
    ;
}
;
