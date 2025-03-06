"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
;
function isAvailableForSuggestion(suggestionTimeSlot, availabilitySlots) {
    if (availabilitySlots.length === 0) {
        return false;
    }
    ;
    for (const slot of availabilitySlots) {
        if (intersectsWithAvailabilitySlot(suggestionTimeSlot, slot)) {
            return true;
        }
        ;
    }
    ;
    return false;
}
;
function intersectsWithAvailabilitySlot(suggestionTimeSlot, availabilitySlot) {
    if (suggestionTimeSlot.start >= availabilitySlot.start && availabilitySlot.end - suggestionTimeSlot.start >= constants_1.minuteMilliseconds) {
        return true;
    }
    ;
    if (suggestionTimeSlot.end <= availabilitySlot.end && suggestionTimeSlot.end - availabilitySlot.start >= constants_1.minuteMilliseconds) {
        return true;
    }
    ;
    if (availabilitySlot.start >= suggestionTimeSlot.start && suggestionTimeSlot.end - availabilitySlot.start >= constants_1.minuteMilliseconds) {
        return true;
    }
    ;
    return false;
}
;
