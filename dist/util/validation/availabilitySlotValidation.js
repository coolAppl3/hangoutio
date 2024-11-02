"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intersectsWithExistingSlots = exports.isValidAvailabilitySlotStart = exports.isValidAvailabilitySlot = exports.availabilitySlotsLimit = void 0;
exports.availabilitySlotsLimit = 10;
function isValidAvailabilitySlot(slotStart, slotEnd) {
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
exports.isValidAvailabilitySlot = isValidAvailabilitySlot;
;
function isValidAvailabilitySlotStart(hangoutConclusionTimestamp, slotStart) {
    const hourMilliseconds = 1000 * 60 * 60;
    const halfYearMilliseconds = hourMilliseconds * 24 * 183;
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
    const minuteMillisecond = 1000 * 60;
    if (Math.abs(newSlotPart - slot.slot_start_timestamp) < minuteMillisecond) {
        return true;
    }
    ;
    if (Math.abs(newSlotPart - slot.slot_end_timestamp) < minuteMillisecond) {
        return true;
    }
    ;
    return false;
}
;
