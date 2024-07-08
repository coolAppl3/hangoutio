"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRecoveryToken = void 0;
const allowedCharacters = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789';
const tokenLength = allowedCharacters.length;
function generateRecoveryToken() {
    let recoveryToken = 'r';
    while (recoveryToken.length < 32) {
        recoveryToken += allowedCharacters[Math.floor(Math.random() * tokenLength)];
    }
    ;
    return recoveryToken;
}
exports.generateRecoveryToken = generateRecoveryToken;
;
