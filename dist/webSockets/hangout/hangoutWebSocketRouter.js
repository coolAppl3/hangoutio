"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hangoutWebSocketRouter = void 0;
;
function isValidClientSentMessage(wsMessage) {
    if (typeof wsMessage !== 'object' || wsMessage === null) {
        return false;
    }
    ;
    if (!('type' in wsMessage) || typeof wsMessage.type !== 'string') {
        return false;
    }
    ;
    if (!('reason' in wsMessage) || typeof wsMessage.reason !== 'string') {
        return false;
    }
    ;
    if (!('data' in wsMessage) || typeof wsMessage.data !== 'object' || wsMessage.data === null) {
        return false;
    }
    ;
    return true;
}
;
function hangoutWebSocketRouter(wsMessage, ws) {
    if (!isValidClientSentMessage(wsMessage)) {
        return;
    }
    ;
}
exports.hangoutWebSocketRouter = hangoutWebSocketRouter;
;
