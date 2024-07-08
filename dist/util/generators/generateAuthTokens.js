"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAuthToken = void 0;
const allowedCharacters = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789';
const tokenLength = allowedCharacters.length;
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
        authToken += allowedCharacters[Math.floor(Math.random() * tokenLength)];
    }
    ;
    return authToken;
}
exports.generateAuthToken = generateAuthToken;
;
