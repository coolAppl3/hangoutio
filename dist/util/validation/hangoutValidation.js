"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidHangoutMemberLimit = exports.isValidHangoutConfiguration = exports.isValidHangoutIDString = void 0;
function isValidHangoutIDString(hangoutID) {
    if (typeof hangoutID !== 'string') {
        return false;
    }
    ;
    if (hangoutID.length !== 32) {
        return false;
    }
    ;
    if (!hangoutID.startsWith('h')) {
        return false;
    }
    ;
    return true;
}
exports.isValidHangoutIDString = isValidHangoutIDString;
;
function isValidHangoutConfiguration(availabilityPeriod, suggestionsPeriod, votingPeriod) {
    if (availabilityPeriod < 1 || availabilityPeriod > 7) {
        return false;
    }
    ;
    if (suggestionsPeriod < 1 || suggestionsPeriod > 14) {
        return false;
    }
    ;
    if (votingPeriod < 1 || votingPeriod > 14) {
        return false;
    }
    ;
    if (!Number.isInteger(availabilityPeriod) ||
        !Number.isInteger(suggestionsPeriod) ||
        !Number.isInteger(votingPeriod)) {
        return false;
    }
    ;
    return true;
}
exports.isValidHangoutConfiguration = isValidHangoutConfiguration;
;
function isValidHangoutMemberLimit(limit) {
    if (!Number.isInteger(limit)) {
        return false;
    }
    ;
    if (limit < 2 || limit > 20) {
        return false;
    }
    ;
    return true;
}
exports.isValidHangoutMemberLimit = isValidHangoutMemberLimit;
;
