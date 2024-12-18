"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intersectsWithExistingSlots = exports.isValidAvailabilitySlotStart = exports.isValidAvailabilitySlot = void 0;
const constants_1 = require("../constants");
function isValidAvailabilitySlot(slotStart, slotEnd) {
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
exports.isValidAvailabilitySlot = isValidAvailabilitySlot;
;
function isValidAvailabilitySlotStart(hangoutConclusionTimestamp, slotStart) {
    const halfYearMilliseconds = (constants_1.dayMilliseconds * 365) / 2;
    if (!isValidTimestamp(hangoutConclusionTimestamp) || !isValidTimestamp(slotStart)) {
        return false;
    }
    ;
    if (slotStart < hangoutConclusionTimestamp) {
        return false;
    }
    ;
    if (slotStart - hangoutConclusionTimestamp > halfYearMilliseconds) {
        return false;
    }
    ;
    return true;
}
exports.isValidAvailabilitySlotStart = isValidAvailabilitySlotStart;
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
;
;
function intersectsWithExistingSlots(existingSlots, newSlot) {
    if (existingSlots.length === 0) {
        return false;
    }
    ;
    for (const slot of existingSlots) {
        if (isWithinExistingSlot(slot, newSlot.slotStartTimestamp) || isWithinExistingSlot(slot, newSlot.slotEndTimestamp)) {
            return true;
        }
        ;
        if (isCloserThanAMinute(slot, newSlot.slotStartTimestamp) || isCloserThanAMinute(slot, newSlot.slotEndTimestamp)) {
            return true;
        }
        ;
    }
    ;
    return false;
}
exports.intersectsWithExistingSlots = intersectsWithExistingSlots;
;
function isWithinExistingSlot(slot, newSlotPart) {
    if (newSlotPart >= slot.slot_start_timestamp && newSlotPart <= slot.slot_end_timestamp) {
        return true;
    }
    ;
    return false;
}
;
function isCloserThanAMinute(slot, newSlotPart) {
    if (Math.abs(newSlotPart - slot.slot_start_timestamp) < constants_1.minuteMilliseconds) {
        return true;
    }
    ;
    if (Math.abs(newSlotPart - slot.slot_end_timestamp) < constants_1.minuteMilliseconds) {
        return true;
    }
    ;
    return false;
}
;
