"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGuestAuthToken = exports.generateAccountAuthToken = void 0;
const allowedCharacters = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789';
const tokenLength = allowedCharacters.length;
function generateAccountAuthToken() {
    let authToken = 'a';
    while (authToken.length < 32) {
        authToken += allowedCharacters[Math.floor(Math.random() * tokenLength)];
    }
    ;
    return authToken;
}
exports.generateAccountAuthToken = generateAccountAuthToken;
;
function generateGuestAuthToken() {
    let authToken = 'g';
    while (authToken.length < 32) {
        authToken += allowedCharacters[Math.floor(Math.random() * tokenLength)];
    }
    ;
    return authToken;
}
exports.generateGuestAuthToken = generateGuestAuthToken;
;
