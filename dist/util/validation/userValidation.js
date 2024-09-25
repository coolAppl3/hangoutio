"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidCode = exports.isValidToken = exports.isValidAuthToken = exports.isValidDisplayName = exports.isValidUsername = exports.isValidPassword = exports.isValidNewPassword = exports.isValidEmail = void 0;
function isValidEmail(email) {
    if (typeof email !== 'string') {
        return false;
    }
    ;
    const regex = /^(?=.{6,254}$)[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]{0,64}@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
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
    if (displayName.trim() !== displayName) {
        return false;
    }
    ;
    const doubleSpacesRemoved = displayName.split(' ').filter((char) => char !== '').join(' ');
    if (displayName !== doubleSpacesRemoved) {
        return false;
    }
    ;
    const regex = /^[A-Za-z ]{1,25}$/;
    return regex.test(displayName);
}
exports.isValidDisplayName = isValidDisplayName;
;
function isValidAuthToken(authToken) {
    if (typeof authToken !== 'string') {
        return false;
    }
    ;
    if (authToken.length < 34) {
        return false;
    }
    ;
    if (!authToken.startsWith('a') && !authToken.startsWith('g')) {
        return false;
    }
    ;
    if (authToken[32] !== '_') {
        return false;
    }
    ;
    if (!Number.isInteger(+authToken.substring(33))) {
        return false;
    }
    ;
    const regex = /^[A-Za-z0-9_]{34,}$/;
    return regex.test(authToken);
}
exports.isValidAuthToken = isValidAuthToken;
;
function isValidToken(token) {
    if (typeof token !== 'string') {
        return false;
    }
    ;
    if (token.length !== 32) {
        return false;
    }
    ;
    return true;
}
exports.isValidToken = isValidToken;
;
function isValidCode(verificationCode) {
    if (typeof verificationCode !== 'string') {
        return false;
    }
    ;
    const regex = /^[A-NP-Z0-9]{6}$/;
    return regex.test(verificationCode);
}
exports.isValidCode = isValidCode;
;
