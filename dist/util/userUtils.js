"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeTillNextRequest = exports.getUserType = exports.getUserId = void 0;
function getUserId(authToken) {
    return +authToken.substring(33);
}
exports.getUserId = getUserId;
;
function getUserType(authToken) {
    if (authToken.startsWith('a')) {
        return 'account';
    }
    ;
    return 'guest';
}
exports.getUserType = getUserType;
;
;
function getTimeTillNextRequest(requestTimestamp, suspensionDuration) {
    const minuteMilliseconds = 1000 * 60;
    const hourMilliseconds = 1000 * 60 * 60;
    const timeRequiredToPass = suspensionDuration === 'day' ? hourMilliseconds * 24 : hourMilliseconds;
    const differenceMilliseconds = Date.now() - requestTimestamp;
    const timeTillNextRequestMilliseconds = timeRequiredToPass - differenceMilliseconds;
    if (timeTillNextRequestMilliseconds < 0) {
        return { hoursRemaining: 0, minutesRemaining: 0 };
    }
    ;
    const hoursRemaining = Math.floor(timeTillNextRequestMilliseconds / hourMilliseconds);
    const minutesRemaining = Math.floor((timeTillNextRequestMilliseconds % hourMilliseconds) / minuteMilliseconds);
    return { hoursRemaining, minutesRemaining };
}
exports.getTimeTillNextRequest = getTimeTillNextRequest;
;
