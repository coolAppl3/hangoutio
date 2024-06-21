"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidUserType = exports.isValidPassword = exports.isValidName = exports.isValidEmail = void 0;
function isValidEmail(email) {
    const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
    return regex.test(email);
}
exports.isValidEmail = isValidEmail;
;
function isValidName(name) {
    const regex = /^[A-Za-z ]{1,25}$/;
    return regex.test(name);
}
exports.isValidName = isValidName;
;
function isValidPassword(password) {
    const regex = /^[A-Za-z0-9._]{8,40}$/;
    return regex.test(password);
}
exports.isValidPassword = isValidPassword;
;
function isValidUserType(userType) {
    if (userType !== 'account' && userType !== 'guest') {
        return false;
    }
    ;
    return true;
}
exports.isValidUserType = isValidUserType;
;
