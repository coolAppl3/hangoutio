"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDateAndTimeSTring = void 0;
function getDateAndTimeSTring(timestamp) {
    const date = new Date(timestamp);
    return `${getMonthName(date)} ${date.getDate()}, ${date.getFullYear()} - ${getTime(date)}`;
}
exports.getDateAndTimeSTring = getDateAndTimeSTring;
;
function getMonthName(date) {
    return new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);
}
;
function getTime(date) {
    return new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' }).format(date);
}
;
