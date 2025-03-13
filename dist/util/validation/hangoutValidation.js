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
    if (!isValidTimestamp(+hangoutId.substring(33))) {
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
        const period = hangoutPeriods[i];
        if (!period || !isValidHangoutPeriod(period)) {
            return false;
        }
        ;
    }
    ;
    return true;
}
exports.isValidHangoutPeriods = isValidHangoutPeriods;
;
function isValidHangoutPeriod(hangoutStage) {
    if (!Number.isInteger(hangoutStage) || hangoutStage <= 0) {
        return false;
    }
    ;
    if (hangoutStage % constants_1.dayMilliseconds !== 0) {
        return false;
    }
    ;
    const hangoutStageDays = hangoutStage / constants_1.dayMilliseconds;
    if (hangoutStageDays < constants_1.MIN_HANGOUT_PERIOD_DAYS || hangoutStageDays > constants_1.MAX_HANGOUT_PERIOD_DAYS) {
        return false;
    }
    ;
    return true;
}
;
;
function isValidNewHangoutPeriods(hangoutStageDetails, existingPeriods, newPeriods) {
    for (let i = 0; i < 3; i++) {
        const existingPeriod = existingPeriods[i];
        const newPeriod = newPeriods[i];
        if (!existingPeriod || !newPeriod) {
            return false;
        }
        ;
        if (i + 1 < hangoutStageDetails.currentStage) {
            if (newPeriod !== existingPeriod) {
                return false;
            }
            ;
            continue;
        }
        ;
        if (!isValidHangoutPeriod(newPeriod)) {
            return false;
        }
        ;
        if (i + 1 === hangoutStageDetails.currentStage && newPeriod <= Date.now() - hangoutStageDetails.stageControlTimestamp) {
            return false;
        }
        ;
    }
    ;
    return true;
}
exports.isValidNewHangoutPeriods = isValidNewHangoutPeriods;
;
