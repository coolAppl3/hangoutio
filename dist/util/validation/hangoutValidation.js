"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidNewHangoutPeriods = exports.isValidHangoutPeriods = exports.isValidHangoutMembersLimit = exports.isValidHangoutTitle = exports.isValidHangoutId = void 0;
const constants_1 = require("../constants");
const globalUtils_1 = require("../globalUtils");
function isValidHangoutId(hangoutId) {
    if (typeof hangoutId !== 'string') {
        return false;
    }
    ;
    if (hangoutId.length !== 46) {
        return false;
    }
    ;
    if (!hangoutId.startsWith('h')) {
        return false;
    }
    ;
    if (hangoutId[32] !== '_') {
        return false;
    }
    ;
    if (hangoutId.substring(33).length !== 13 || !isValidTimestamp(+hangoutId.substring(33))) {
        return false;
    }
    ;
    const regex = /^[A-Za-z0-9_]{46,}$/;
    return regex.test(hangoutId);
}
exports.isValidHangoutId = isValidHangoutId;
;
function isValidHangoutTitle(title) {
    if (typeof title !== 'string') {
        return false;
    }
    ;
    if ((0, globalUtils_1.containsInvalidWhitespace)(title)) {
        return false;
    }
    ;
    const regex = /^[A-Za-z ]{3,25}$/;
    return regex.test(title);
}
exports.isValidHangoutTitle = isValidHangoutTitle;
;
function isValidHangoutMembersLimit(limit) {
    if (!Number.isInteger(limit)) {
        return false;
    }
    ;
    if (limit < constants_1.MIN_HANGOUT_MEMBERS_LIMIT || limit > constants_1.MAX_HANGOUT_MEMBERS_LIMIT) {
        return false;
    }
    ;
    return true;
}
exports.isValidHangoutMembersLimit = isValidHangoutMembersLimit;
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
function isValidHangoutPeriods(hangoutPeriods) {
    if (hangoutPeriods.length !== 3) {
        return false;
    }
    ;
    for (let i = 0; i < hangoutPeriods.length; i++) {
        if (!isValidHangoutPeriod(hangoutPeriods[i])) {
            return false;
        }
        ;
    }
    ;
    return true;
}
exports.isValidHangoutPeriods = isValidHangoutPeriods;
;
function isValidHangoutPeriod(hangoutStep) {
    if (!Number.isInteger(hangoutStep) || hangoutStep <= 0) {
        return false;
    }
    ;
    if (hangoutStep % constants_1.dayMilliseconds !== 0) {
        return false;
    }
    ;
    const hangoutStepDays = hangoutStep / constants_1.dayMilliseconds;
    if (hangoutStepDays < constants_1.MIN_HANGOUT_PERIOD_DAYS || hangoutStepDays > constants_1.MAX_HANGOUT_PERIOD_DAYS) {
        return false;
    }
    ;
    return true;
}
;
;
function isValidNewHangoutPeriods(hangoutDetails, existingPeriods, newPeriods) {
    if (hangoutDetails.currentStage === constants_1.HANGOUT_CONCLUSION_STAGE) {
        return false;
    }
    ;
    for (let i = 1; i <= 3; i++) {
        if (i < hangoutDetails.currentStage) {
            if (newPeriods[i] !== existingPeriods[i]) {
                return false;
            }
            ;
            continue;
        }
        ;
        if (!isValidHangoutPeriod(newPeriods[i])) {
            return false;
        }
        ;
        if (i === hangoutDetails.currentStage && newPeriods[i] <= hangoutDetails.stageControlTimestamp) {
            return false;
        }
        ;
    }
    ;
    return true;
}
exports.isValidNewHangoutPeriods = isValidNewHangoutPeriods;
;
