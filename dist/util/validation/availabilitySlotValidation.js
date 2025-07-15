"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.overlapsWithExistingAvailabilitySlots = exports.isValidAvailabilitySlotStart = exports.isValidAvailabilitySlot = void 0;
const constants_1 = require("../constants");
const hangoutValidation_1 = require("./hangoutValidation");
function isValidAvailabilitySlot(slotStart, slotEnd) {
    if (!(0, hangoutValidation_1.isValidTimestamp)(slotStart) || !(0, hangoutValidation_1.isValidTimestamp)(slotEnd)) {
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
exports.isValidAvailabilitySlotStart = isValidAvailabilitySlotStart;
;
;
function overlapsWithExistingAvailabilitySlots(existingSlots, newSlotTimestamps) {
    if (existingSlots.length === 0) {
        return null;
    }
    ;
    for (const existingSlot of existingSlots) {
        if (existingSlot.slot_start_timestamp >= newSlotTimestamps.slotStartTimestamp && existingSlot.slot_start_timestamp <= newSlotTimestamps.slotEndTimestamp) {
            return existingSlot;
        }
        ;
        if (existingSlot.slot_end_timestamp >= newSlotTimestamps.slotStartTimestamp && existingSlot.slot_end_timestamp <= newSlotTimestamps.slotEndTimestamp) {
            return existingSlot;
        }
        ;
        if (existingSlot.slot_start_timestamp <= newSlotTimestamps.slotStartTimestamp && existingSlot.slot_end_timestamp >= newSlotTimestamps.slotEndTimestamp) {
            return existingSlot;
        }
        ;
    }
    ;
    return null;
}
exports.overlapsWithExistingAvailabilitySlots = overlapsWithExistingAvailabilitySlots;
;
