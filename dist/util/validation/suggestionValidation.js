"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSuggestionSlotStart = exports.isValidSuggestionTimeSlot = exports.isValidSuggestionDescription = exports.isValidSuggestionTitle = void 0;
const constants_1 = require("../constants");
const globalUtils_1 = require("../globalUtils");
const hangoutValidation_1 = require("./hangoutValidation");
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
    if (!(0, hangoutValidation_1.isValidTimestamp)(slotStart) || !(0, hangoutValidation_1.isValidTimestamp)(slotEnd)) {
        return false;
    }
    ;
    const slotLength = slotEnd - slotStart;
    if (slotLength < constants_1.hourMilliseconds || slotLength > constants_1.dayMilliseconds) {
        return false;
    }
    ;
    return true;
}
exports.isValidSuggestionTimeSlot = isValidSuggestionTimeSlot;
;
function isValidSuggestionSlotStart(hangoutConclusionTimestamp, slotStart) {
    if (slotStart < hangoutConclusionTimestamp) {
        return false;
    }
    ;
    const dateObj = new Date(hangoutConclusionTimestamp);
    const furthestPossibleTimestamp = dateObj.setMonth(dateObj.getMonth() + 6);
    if (slotStart > furthestPossibleTimestamp) {
        return false;
    }
    ;
    return true;
}
exports.isValidSuggestionSlotStart = isValidSuggestionSlotStart;
;
