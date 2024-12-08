"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDateAndTimeString = void 0;
function getDateAndTimeString(timestamp) {
    const date = new Date(timestamp);
    return `${getMonthName(date)} ${date.getDate()}, ${date.getFullYear()} - ${getTime(date)}`;
}
exports.getDateAndTimeString = getDateAndTimeString;
;
function getMonthName(date) {
    return new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);
}
;
function getTime(date) {
    return new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' }).format(date);
}
;
