"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidNewPeriods = exports.isValidHangoutMemberLimit = exports.isValidHangoutConfiguration = exports.isValidHangoutIDString = void 0;
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
;
;
function isValidNewPeriods(hangoutDetails, newPeriods) {
    const daysPassed = getDaysPassed(hangoutDetails.stepTimestamp);
    if (hangoutDetails.currentStep === 1) {
        if (newPeriods.newAvailabilityPeriod < daysPassed || newPeriods.newAvailabilityPeriod === daysPassed) {
            return false;
        }
        ;
    }
    ;
    if (hangoutDetails.currentStep === 2) {
        if (newPeriods.newAvailabilityPeriod !== hangoutDetails.currentAvailabilityPeriod) {
            return false;
        }
        ;
        if (newPeriods.newSuggestionsPeriod < daysPassed || newPeriods.newSuggestionsPeriod === daysPassed) {
            return false;
        }
        ;
    }
    ;
    if (hangoutDetails.currentStep === 3) {
        if (newPeriods.newAvailabilityPeriod !== hangoutDetails.currentAvailabilityPeriod) {
            return false;
        }
        ;
        if (newPeriods.newSuggestionsPeriod !== hangoutDetails.currentSuggestionsPeriod) {
            return false;
        }
        ;
        if (newPeriods.newVotingPeriod < daysPassed || newPeriods.newVotingPeriod === daysPassed) {
            return false;
        }
        ;
    }
    ;
    return true;
}
exports.isValidNewPeriods = isValidNewPeriods;
;
function getDaysPassed(stepTimeStamp) {
    const dayMilliseconds = 1000 * 60 * 60 * 24;
    const daysPassed = Math.floor((Date.now() - stepTimeStamp) / dayMilliseconds);
    return daysPassed;
}
;
