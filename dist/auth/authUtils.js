"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidAuthSessionDetails = exports.isValidAuthSessionId = void 0;
function isValidAuthSessionId(authSessionId) {
    if (authSessionId.length !== 32) {
        return false;
    }
    ;
    const regex = /^[A-Za-z0-9]{32}$/;
    return regex.test(authSessionId);
}
exports.isValidAuthSessionId = isValidAuthSessionId;
;
;
function isValidAuthSessionDetails(authSessionDetails, expectedUserType = null) {
    if (expectedUserType && authSessionDetails.user_type !== expectedUserType) {
        return false;
    }
    ;
    if (authSessionDetails.expiry_timestamp <= Date.now()) {
        return false;
    }
    ;
    return true;
}
exports.isValidAuthSessionDetails = isValidAuthSessionDetails;
;
