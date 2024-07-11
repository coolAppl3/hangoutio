"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCancellationToken = void 0;
const allowedCharacters = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789';
const tokenLength = allowedCharacters.length;
function generateCancellationToken() {
    let cancellationToken = 'c';
    while (cancellationToken.length < 32) {
        cancellationToken += allowedCharacters[Math.floor(Math.random() * tokenLength)];
    }
    ;
    return cancellationToken;
}
exports.generateCancellationToken = generateCancellationToken;
;
