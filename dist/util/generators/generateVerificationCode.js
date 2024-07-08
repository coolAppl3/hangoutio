"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVerificationCode = void 0;
const allowedCharacters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789';
const codeLength = allowedCharacters.length;
function generateVerificationCode() {
    let verificationCode = '';
    while (verificationCode.length < 6) {
        verificationCode += allowedCharacters[Math.floor(Math.random() * codeLength)];
    }
    ;
    return verificationCode;
}
exports.generateVerificationCode = generateVerificationCode;
;
