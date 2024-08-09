"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHangoutID = exports.generateUniqueToken = exports.generateUniqueCode = exports.generateAuthToken = void 0;
const allowedTokenCharacters = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789';
const allowedCodeCharacters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789';
function generateAuthToken(userType) {
    let authToken = '';
    if (userType === 'account') {
        authToken = 'a';
    }
    ;
    if (userType === 'guest') {
        authToken = 'g';
    }
    ;
    while (authToken.length < 32) {
        authToken += allowedTokenCharacters[Math.floor(Math.random() * allowedTokenCharacters.length)];
    }
    ;
    return authToken;
}
exports.generateAuthToken = generateAuthToken;
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
function generateHangoutID(timestamp) {
    let hangoutID = 'h';
    while (hangoutID.length < 32) {
        hangoutID += allowedTokenCharacters[Math.floor(Math.random() * allowedTokenCharacters.length)];
    }
    ;
    return `${hangoutID}_${timestamp}`;
}
exports.generateHangoutID = generateHangoutID;
;
