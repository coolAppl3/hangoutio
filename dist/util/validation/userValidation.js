"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidAuthTokenString = exports.isValidVerificationCode = exports.isValidPassword = exports.isValidName = exports.isValidEmail = void 0;
function isValidEmail(email) {
    if (typeof email !== 'string') {
        return false;
    }
    ;
    const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
    return regex.test(email);
}
exports.isValidEmail = isValidEmail;
;
function isValidName(name) {
    if (typeof name !== 'string') {
        return false;
    }
    ;
    const regex = /^[A-Za-z ]{1,25}$/;
    return regex.test(name);
}
exports.isValidName = isValidName;
;
function isValidPassword(password) {
    if (typeof password !== 'string') {
        return false;
    }
    ;
    const regex = /^[A-Za-z0-9._]{8,40}$/;
    return regex.test(password);
}
exports.isValidPassword = isValidPassword;
;
function isValidVerificationCode(verificationCode) {
    if (typeof verificationCode !== 'string') {
        return false;
    }
    ;
    const regex = /^[A-NP-Z0-9]{6}$/;
    return regex.test(verificationCode);
}
exports.isValidVerificationCode = isValidVerificationCode;
;
function isValidAuthTokenString(authToken) {
    if (typeof authToken !== 'string') {
        return false;
    }
    ;
    if (authToken.length !== 32) {
        return false;
    }
    ;
    if (!authToken.startsWith('a') && !authToken.startsWith('g')) {
        return false;
    }
    ;
    return true;
}
exports.isValidAuthTokenString = isValidAuthTokenString;
;
