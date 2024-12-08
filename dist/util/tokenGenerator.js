"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHangoutId = exports.generateUniqueToken = exports.generateUniqueCode = exports.generateAuthSessionId = void 0;
const allowedTokenCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const allowedCodeCharacters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789';
function generateAuthSessionId() {
    let sessionId = '';
    while (sessionId.length < 32) {
        sessionId += allowedTokenCharacters[Math.floor(Math.random() * allowedTokenCharacters.length)];
    }
    ;
    return sessionId;
}
exports.generateAuthSessionId = generateAuthSessionId;
;
function generateUniqueCode() {
    let verificationCode = '';
    while (verificationCode.length < 6) {
        verificationCode += allowedCodeCharacters[Math.floor(Math.random() * allowedCodeCharacters.length)];
    }
    ;
    return verificationCode;
}
exports.generateUniqueCode = generateUniqueCode;
;
function generateUniqueToken() {
    let token = '';
    while (token.length < 32) {
        token += allowedTokenCharacters[Math.floor(Math.random() * allowedTokenCharacters.length)];
    }
    ;
    return token;
}
exports.generateUniqueToken = generateUniqueToken;
;
function generateHangoutId(timestamp) {
    let hangoutId = 'h';
    while (hangoutId.length < 32) {
        hangoutId += allowedTokenCharacters[Math.floor(Math.random() * allowedTokenCharacters.length)];
    }
    ;
    return `${hangoutId}_${timestamp}`;
}
exports.generateHangoutId = generateHangoutId;
;
