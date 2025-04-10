"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendHangoutWebSocketMessage = exports.wss = exports.wsMap = void 0;
const ws_1 = __importDefault(require("ws"));
const hangoutWebSocketRouter_1 = require("./hangoutWebSocketRouter");
exports.wsMap = new Map();
exports.wss = new ws_1.default.Server({
    noServer: true,
    maxPayload: 1700,
    clientTracking: false,
    perMessageDeflate: false,
});
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
        (0, hangoutWebSocketRouter_1.hangoutWebSocketRouter)(messageContent, ws);
    });
    ws.on('error', (err) => {
        console.log(err);
        if (ws.readyState !== 2 && ws.readyState !== 3) {
            ws.close();
        }
        ;
    });
    ws.on('close', () => {
        for (const wsSet of exports.wsMap.values()) {
            const foundAndDeleted = wsSet.delete(ws);
            if (foundAndDeleted) {
                return;
            }
            ;
        }
        ;
    });
});
console.log('Hangout websocket server started.');
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
;
function sendHangoutWebSocketMessage(hangoutIds, webSocketData) {
    try {
        for (const hangoutId of hangoutIds) {
            const wsSet = exports.wsMap.get(hangoutId);
            if (!wsSet) {
                continue;
            }
            ;
            for (const ws of wsSet.values()) {
                ws.send(JSON.stringify(webSocketData), (err) => err && console.log(err));
            }
            ;
        }
        ;
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.sendHangoutWebSocketMessage = sendHangoutWebSocketMessage;
;
