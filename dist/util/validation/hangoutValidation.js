"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidHangoutConfiguration = exports.isValidHangoutID = void 0;
function isValidHangoutID(hangoutID) {
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
exports.isValidHangoutID = isValidHangoutID;
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
