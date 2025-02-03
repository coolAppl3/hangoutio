"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidMessageContent = void 0;
function isValidMessageContent(message) {
    if (typeof message !== 'string') {
        return false;
    }
    ;
    if (message !== message.trim()) {
        return false;
    }
    ;
    const messageRegex = /^[ -~\r\n]{1,500}$/;
    return messageRegex.test(message);
}
exports.isValidMessageContent = isValidMessageContent;
;
