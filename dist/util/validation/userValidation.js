"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidRandomCode = exports.isValidDisplayName = exports.isValidUsername = exports.isValidPassword = exports.isValidNewPassword = exports.isValidEmail = void 0;
const globalUtils_1 = require("../globalUtils");
function isValidEmail(email) {
    if (typeof email !== 'string') {
        return false;
    }
    ;
    const regex = /^(?=.{6,254}$)[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]{0,64}@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}?(?:\.[a-zA-Z]{2,})*$/;
    return regex.test(email);
}
exports.isValidEmail = isValidEmail;
;
function isValidNewPassword(password) {
    if (typeof password !== 'string') {
        return false;
    }
    ;
    const regex = /^[A-Za-z0-9._]{8,40}$/;
    return regex.test(password);
}
exports.isValidNewPassword = isValidNewPassword;
;
function isValidPassword(password) {
    if (typeof password !== 'string' || password.trim() === '') {
        return false;
    }
    ;
    return true;
}
exports.isValidPassword = isValidPassword;
;
function isValidUsername(username) {
    if (typeof username !== 'string') {
        return false;
    }
    ;
    const regex = /^[A-Za-z0-9_.]{5,25}$/;
    return regex.test(username);
}
exports.isValidUsername = isValidUsername;
;
function isValidDisplayName(displayName) {
    if (typeof displayName !== 'string') {
        return false;
    }
    ;
    if ((0, globalUtils_1.containsInvalidWhitespace)(displayName)) {
        return false;
    }
    ;
    const regex = /^[A-Za-z ]{1,25}$/;
    return regex.test(displayName);
}
exports.isValidDisplayName = isValidDisplayName;
;
function isValidRandomCode(verificationCode) {
    if (typeof verificationCode !== 'string') {
        return false;
    }
    ;
    const regex = /^[A-NP-Z0-9]{6}$/;
    return regex.test(verificationCode);
}
exports.isValidRandomCode = isValidRandomCode;
;
