"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertIntoHangoutClients = exports.hangoutClients = exports.wss = void 0;
const ws_1 = __importDefault(require("ws"));
const hangoutWebsocketServerRouter_1 = require("./hangoutWebsocketServerRouter");
exports.wss = new ws_1.default.Server({
    noServer: true,
    maxPayload: 1700,
    clientTracking: false,
    perMessageDeflate: false,
});
console.log('Hangout websocket server started.');
exports.wss.on('connection', (ws) => {
    console.log('Client connected.');
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
        (0, hangoutWebsocketServerRouter_1.hangoutWebSocketServerRouter)(messageContent, ws);
    });
    ws.on('error', (err) => {
        console.log(err);
        if (ws.readyState !== 2 && ws.readyState !== 3) {
            ws.close();
        }
        ;
    });
    ws.on('close', () => {
        console.log('Client disconnected.');
    });
});
exports.hangoutClients = new Map();
function insertIntoHangoutClients(hangoutId, hangoutMemberId, ws) {
    if (!exports.hangoutClients.has(hangoutId)) {
        exports.hangoutClients.set(hangoutId, new Set());
        exports.hangoutClients.get(hangoutId)?.add({ ws, hangoutMemberId });
        return;
    }
    ;
    exports.hangoutClients.get(hangoutId)?.add({ ws, hangoutMemberId });
}
exports.insertIntoHangoutClients = insertIntoHangoutClients;
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
