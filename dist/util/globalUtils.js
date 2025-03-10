"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.containsInvalidWhitespace = exports.getDateAndTimeString = void 0;
function getDateAndTimeString(timestamp) {
    const dateObj = new Date(timestamp);
    const date = dateObj.getDate();
    const ordinalSuffix = getDateOrdinalSuffix(date);
    return `${getMonthName(dateObj)} ${date}${ordinalSuffix}, ${getTime(dateObj)}`;
}
exports.getDateAndTimeString = getDateAndTimeString;
;
function getMonthName(date) {
    return new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);
}
;
function getTime(date) {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}
;
function getDateOrdinalSuffix(date) {
    if (date % 100 >= 11 && date % 100 <= 13) {
        return 'th';
    }
    ;
    if (date % 10 === 1)
        return 'st';
    if (date % 10 === 2)
        return 'nd';
    if (date % 10 === 3)
        return 'rd';
    return 'th';
}
;
function containsInvalidWhitespace(string) {
    if (string.trim() !== string) {
        return true;
    }
    ;
    const doubleWhitespacesRemoved = string.split(' ').filter((char) => char !== '').join(' ');
    if (string !== doubleWhitespacesRemoved) {
        return true;
    }
    ;
    return false;
}
exports.containsInvalidWhitespace = containsInvalidWhitespace;
;
