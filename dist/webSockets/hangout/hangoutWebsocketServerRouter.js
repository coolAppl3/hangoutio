"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hangoutWebSocketServerRouter = void 0;
;
function isValidClientSentMessage(messageContent) {
    if (typeof messageContent !== 'object' || messageContent === null) {
        return false;
    }
    ;
    if (!('type' in messageContent) || typeof messageContent.type !== 'string') {
        return false;
    }
    ;
    if (!('reason' in messageContent) || typeof messageContent.reason !== 'string') {
        return false;
    }
    ;
    if (!('data' in messageContent) || typeof messageContent.data !== 'object') {
        return false;
    }
    ;
    if (messageContent.data === null || Object.getPrototypeOf(messageContent.data) !== Object.prototype) {
        return false;
    }
    ;
    return true;
}
;
function hangoutWebSocketServerRouter(messageContent, ws) {
    if (!isValidClientSentMessage(messageContent)) {
        return;
    }
    ;
    if (messageContent.type === 'chatUpdate') {
        handleHangoutChatUpdates(messageContent, ws);
    }
    ;
}
exports.hangoutWebSocketServerRouter = hangoutWebSocketServerRouter;
;
function handleHangoutChatUpdates(messageContent, ws) {
    if (messageContent.reason === 'userTyping') {
        return;
    }
    ;
}
;
