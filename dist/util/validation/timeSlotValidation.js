"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidTimeSlotsString = void 0;
const validTimeFormatRegex = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
function isValidTimeSlotsString(slotsString) {
    const timeSlotsArray = [];
    if (typeof slotsString !== 'string') {
        return false;
    }
    ;
    if (slotsString.length === 0) {
        return true;
    }
    ;
    if (!isValidSlotStringLength(slotsString)) {
        return false;
    }
    ;
    const slotsArray = slotsString.split(',');
    if (slotsArray.length > 3) {
        return false;
    }
    ;
    for (const slot of slotsArray) {
        if (!isValidSlot(slot, timeSlotsArray)) {
            return false;
        }
        ;
    }
    ;
    return true;
}
exports.isValidTimeSlotsString = isValidTimeSlotsString;
;
function isValidSlotStringLength(slotsString) {
    const validLengths = [13, 27, 41];
    return validLengths.includes(slotsString.length);
}
;
function isValidSlot(slot, timeSlotsArray) {
    const timeValueArray = slot.split(' - ');
    const from = timeValueArray[0];
    const to = timeValueArray[1];
    if (!isValidTimeFormat(from) || !isValidTimeFormat(to)) {
        return false;
    }
    ;
    if (getTimeNumber(to) - getTimeNumber(from) < 100) {
        return false;
    }
    ;
    const newSlot = { from, to };
    if (timeSlotsArray.length === 0) {
        timeSlotsArray.push(newSlot);
        return true;
    }
    ;
    if (intersectsWithExistingSlots(newSlot, timeSlotsArray)) {
        return false;
    }
    ;
    timeSlotsArray.push(newSlot);
    return true;
}
;
function intersectsWithExistingSlots(newSlot, timeSlotsArray) {
    for (const slot of timeSlotsArray) {
        if (endsMatch(slot, newSlot)) {
            return true;
        }
        ;
        if (isWithinExistingSlot(slot, newSlot.from) || isWithinExistingSlot(slot, newSlot.to)) {
            return true;
        }
        ;
        if (includesExistingSlot(slot, newSlot)) {
            return true;
        }
        ;
    }
    ;
    return false;
}
;
function endsMatch(slot, newSlot) {
    if (slot.from === newSlot.from || slot.from === newSlot.to) {
        return true;
    }
    ;
    if (slot.to === newSlot.from || slot.to === newSlot.to) {
        return true;
    }
    ;
    return false;
}
;
function isWithinExistingSlot(slot, time) {
    const slotFrom = getTimeNumber(slot.from);
    const slotTo = getTimeNumber(slot.to);
    const timeNumber = getTimeNumber(time);
    if (timeNumber > slotFrom && timeNumber < slotTo) {
        return true;
    }
    ;
    return false;
}
;
function includesExistingSlot(slot, newSlot) {
    if (getTimeNumber(newSlot.from) < getTimeNumber(slot.from) && getTimeNumber(newSlot.to) > getTimeNumber(slot.to)) {
        return true;
    }
    ;
    return false;
}
;
function getTimeNumber(time) {
    const timeNumber = +(time.split(':').join(''));
    if (Number.isNaN(timeNumber)) {
        return 0;
    }
    ;
    return timeNumber;
}
;
function isValidTimeFormat(timeValue) {
    return validTimeFormatRegex.test(timeValue);
}
;
