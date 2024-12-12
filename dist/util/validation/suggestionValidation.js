"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSuggestionSlotStart = exports.isValidSuggestionTimeSlot = exports.isValidSuggestionDescription = exports.isValidSuggestionTitle = void 0;
function isValidSuggestionTitle(title) {
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
    const titleRegex = /^[-A-Za-z0-9 ()!?.]{3,40}$/;
    return titleRegex.test(title);
}
exports.isValidSuggestionTitle = isValidSuggestionTitle;
;
function isValidSuggestionDescription(description) {
    if (typeof description !== 'string') {
        return false;
    }
    ;
    if (description !== description.trim()) {
        return false;
    }
    ;
    const descriptionRegex = /^[ -~\u20AC\r\n]{10,500}$/;
    return descriptionRegex.test(description);
}
exports.isValidSuggestionDescription = isValidSuggestionDescription;
;
function isValidSuggestionTimeSlot(slotStart, slotEnd) {
    if (!isValidTimestamp(slotStart) || !isValidTimestamp(slotEnd)) {
        return false;
    }
    ;
    const hourMilliseconds = 1000 * 60 * 60;
    const slotLength = slotEnd - slotStart;
    if (slotLength < hourMilliseconds || slotLength > hourMilliseconds * 24) {
        return false;
    }
    ;
    return true;
}
exports.isValidSuggestionTimeSlot = isValidSuggestionTimeSlot;
;
function isValidSuggestionSlotStart(hangoutConclusionTimestamp, slotStart) {
    const hourMilliseconds = 1000 * 60 * 60;
    const yearMilliseconds = hourMilliseconds * 24 * 365;
    if (!isValidTimestamp(hangoutConclusionTimestamp) || !isValidTimestamp(slotStart)) {
        return false;
    }
    ;
    if (slotStart < hangoutConclusionTimestamp) {
        return false;
    }
    ;
    if (slotStart - hangoutConclusionTimestamp > yearMilliseconds) {
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
