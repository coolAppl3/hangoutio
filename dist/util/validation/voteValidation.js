"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAvailableForSuggestion = void 0;
;
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
exports.isAvailableForSuggestion = isAvailableForSuggestion;
;
function intersectsWithAvailabilitySlot(suggestionTimeSlot, availabilitySlot) {
    const hourMilliseconds = 1000 * 60 * 60;
    if (suggestionTimeSlot.start >= availabilitySlot.start && availabilitySlot.end - suggestionTimeSlot.start >= hourMilliseconds) {
        return true;
    }
    ;
    if (suggestionTimeSlot.end <= availabilitySlot.end && suggestionTimeSlot.end - availabilitySlot.start >= hourMilliseconds) {
        return true;
    }
    ;
    if (availabilitySlot.start >= suggestionTimeSlot.start && suggestionTimeSlot.end - availabilitySlot.start >= hourMilliseconds) {
        return true;
    }
    ;
    return false;
}
;
