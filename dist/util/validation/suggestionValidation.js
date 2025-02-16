"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSuggestionSlotStart = exports.isValidSuggestionTimeSlot = exports.isValidSuggestionDescription = exports.isValidSuggestionTitle = void 0;
const constants_1 = require("../constants");
const globalUtils_1 = require("../globalUtils");
function isValidSuggestionTitle(title) {
    if (typeof title !== 'string') {
        return false;
    }
    ;
    if ((0, globalUtils_1.containsInvalidWhitespace)(title)) {
        return false;
    }
    ;
    const regex = /^[-A-Za-z0-9 ()!?.]{3,40}$/;
    return regex.test(title);
}
exports.isValidSuggestionTitle = isValidSuggestionTitle;
;
function isValidSuggestionDescription(description) {
    if (typeof description !== 'string') {
        return false;
    }
    ;
    if (description.trim() !== description) {
        return false;
    }
    ;
    const regex = /^[ -~\r\n]{10,500}$/;
    return regex.test(description);
}
exports.isValidSuggestionDescription = isValidSuggestionDescription;
;
function isValidSuggestionTimeSlot(slotStart, slotEnd) {
    if (!isValidTimestamp(slotStart) || !isValidTimestamp(slotEnd)) {
        return false;
    }
    ;
    const slotLength = slotEnd - slotStart;
    if (slotLength < constants_1.hourMilliseconds || slotLength > constants_1.hourMilliseconds * 24) {
        return false;
    }
    ;
    return true;
}
exports.isValidSuggestionTimeSlot = isValidSuggestionTimeSlot;
;
function isValidSuggestionSlotStart(hangoutConclusionTimestamp, slotStart) {
    const dateObj = new Date(hangoutConclusionTimestamp);
    const furthestPossibleTimestamp = dateObj.setMonth(dateObj.getMonth() + 6);
    if (slotStart < hangoutConclusionTimestamp) {
        return false;
    }
    ;
    if (slotStart - hangoutConclusionTimestamp > furthestPossibleTimestamp) {
        return false;
    }
    ;
    return true;
}
exports.isValidSuggestionSlotStart = isValidSuggestionSlotStart;
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
