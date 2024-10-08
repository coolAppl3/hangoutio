"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidNewHangoutSteps = exports.isValidHangoutSteps = exports.isValidHangoutStep = exports.isValidHangoutMemberLimit = exports.isValidHangoutTitle = exports.isValidHangoutID = exports.ongoingHangoutsLimit = exports.hangoutMemberLimit = void 0;
exports.hangoutMemberLimit = 20;
exports.ongoingHangoutsLimit = 12;
function isValidHangoutID(hangoutID) {
    if (typeof hangoutID !== 'string') {
        return false;
    }
    ;
    if (hangoutID.length !== 46) {
        return false;
    }
    ;
    if (!hangoutID.startsWith('h')) {
        return false;
    }
    ;
    if (hangoutID[32] !== '_') {
        return false;
    }
    ;
    if (hangoutID.substring(33).length !== 13 || !isValidTimestamp(+hangoutID.substring(33))) {
        return false;
    }
    ;
    const regex = /^[A-Za-z0-9_]{46,}$/;
    return regex.test(hangoutID);
}
exports.isValidHangoutID = isValidHangoutID;
;
function isValidHangoutTitle(title) {
    if (typeof title !== 'string') {
        return false;
    }
    ;
    if (title.trim() !== title) {
        return false;
    }
    ;
    const doubleSpacesRemoved = title.split(' ').filter((char) => char !== '').join(' ');
    if (title !== doubleSpacesRemoved) {
        return false;
    }
    ;
    const regex = /^[A-Za-z ]{3,25}$/;
    return regex.test(title);
}
exports.isValidHangoutTitle = isValidHangoutTitle;
;
function isValidHangoutMemberLimit(limit) {
    if (!Number.isInteger(limit)) {
        return false;
    }
    ;
    if (limit < 2 || limit > exports.hangoutMemberLimit) {
        return false;
    }
    ;
    return true;
}
exports.isValidHangoutMemberLimit = isValidHangoutMemberLimit;
;
function isValidTimestamp(timestamp) {
    const timeStampLength = 13;
    if (!Number.isInteger(timestamp)) {
        return false;
    }
    ;
    if (timestamp.toString().length !== timeStampLength) {
        return false;
    }
    ;
    if (timestamp < 0) {
        return false;
    }
    ;
    return true;
}
;
function isValidHangoutStep(hangoutStep) {
    if (!Number.isInteger(hangoutStep) || hangoutStep <= 0) {
        return false;
    }
    ;
    const dayMilliseconds = 1000 * 60 * 60 * 24;
    if (hangoutStep % dayMilliseconds !== 0) {
        return false;
    }
    ;
    const hangoutStepDays = hangoutStep / dayMilliseconds;
    if (hangoutStepDays < 1 || hangoutStepDays > 7) {
        return false;
    }
    ;
    return true;
}
exports.isValidHangoutStep = isValidHangoutStep;
;
function isValidHangoutSteps(currentStep, hangoutSteps) {
    if (hangoutSteps.length === 0) {
        return false;
    }
    ;
    for (let i = 0; i < hangoutSteps.length; i++) {
        if (i < --currentStep) {
            continue;
        }
        ;
        if (!isValidHangoutStep(hangoutSteps[i])) {
            return false;
        }
        ;
    }
    ;
    return true;
}
exports.isValidHangoutSteps = isValidHangoutSteps;
;
;
;
function isValidNewHangoutSteps(hangoutDetails, newSteps) {
    for (const stepKey in newSteps) {
        if (!Number.isInteger(newSteps[stepKey])) {
            return false;
        }
        ;
    }
    ;
    if (noStepChange(hangoutDetails, newSteps)) {
        return false;
    }
    ;
    const currentTimestamp = Date.now();
    if (hangoutDetails.current_step === 1) {
        if (getStepEndTimestamp(hangoutDetails.current_step_timestamp, newSteps.newAvailabilityStep) <= currentTimestamp) {
            return false;
        }
        ;
    }
    ;
    if (hangoutDetails.current_step === 2) {
        if (newSteps.newAvailabilityStep !== hangoutDetails.availability_step) {
            return false;
        }
        ;
        if (getStepEndTimestamp(hangoutDetails.current_step_timestamp, newSteps.newSuggestionsStep) <= currentTimestamp) {
            return false;
        }
        ;
    }
    ;
    if (hangoutDetails.current_step === 3) {
        if (newSteps.newAvailabilityStep !== hangoutDetails.availability_step) {
            return false;
        }
        ;
        if (newSteps.newSuggestionsStep !== hangoutDetails.suggestions_step) {
            return false;
        }
        ;
        if (getStepEndTimestamp(hangoutDetails.current_step_timestamp, newSteps.newVotingStep) <= currentTimestamp) {
            return false;
        }
        ;
    }
    ;
    return true;
}
exports.isValidNewHangoutSteps = isValidNewHangoutSteps;
;
function noStepChange(hangoutDetails, newSteps) {
    if (newSteps.newAvailabilityStep === hangoutDetails.availability_step &&
        newSteps.newSuggestionsStep === hangoutDetails.suggestions_step &&
        newSteps.newVotingStep === hangoutDetails.voting_step) {
        return true;
    }
    ;
    return false;
}
;
function getStepEndTimestamp(currentStepTimestamp, stepLength) {
    return currentStepTimestamp + stepLength;
}
;
