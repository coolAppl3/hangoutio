"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearExpiredHangoutWebSockets = exports.hangoutClients = exports.wss = void 0;
const ws_1 = __importDefault(require("ws"));
const hangoutWebSocketRouter_1 = require("./hangoutWebSocketRouter");
const constants_1 = require("../../util/constants");
exports.wss = new ws_1.default.Server({
    noServer: true,
    maxPayload: 1700,
    clientTracking: false,
    perMessageDeflate: false,
});
console.log('Hangout websocket server started.');
exports.wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        if (!Buffer.isBuffer(data)) {
            ws.send(JSON.stringify({ success: false, message: 'Invalid buffer received.', reason: 'notBuffer' }));
            return;
        }
        ;
        const decodedData = data.toString();
        const messageContent = parseJsonString(decodedData);
        if (messageContent === null) {
            ws.send(JSON.stringify({ success: false, message: 'Invalid buffer received', reason: 'invalidJson' }));
            return;
        }
        ;
        (0, hangoutWebSocketRouter_1.hangoutWebSocketServerRouter)(messageContent, ws);
    });
    ws.on('error', (err) => {
        console.log(err);
        if (ws.readyState !== 2 && ws.readyState !== 3) {
            ws.close();
        }
        ;
    });
    ws.on('close', () => { });
});
;
exports.hangoutClients = new Map();
function clearExpiredHangoutWebSockets() {
    for (const [hangoutMemberId, webSocketClientData] of exports.hangoutClients) {
        if (webSocketClientData.createdOn + (constants_1.hourMilliseconds * 6) < Date.now()) {
            webSocketClientData.ws.close();
            exports.hangoutClients.delete(hangoutMemberId);
            continue;
        }
        ;
        if (webSocketClientData.ws.readyState === 2 || webSocketClientData.ws.readyState === 3) {
            exports.hangoutClients.delete(hangoutMemberId);
        }
        ;
    }
    ;
}
exports.clearExpiredHangoutWebSockets = clearExpiredHangoutWebSockets;
;
function parseJsonString(message) {
    try {
        return JSON.parse(message);
    }
    catch (err) {
        return null;
    }
    ;
}
;
