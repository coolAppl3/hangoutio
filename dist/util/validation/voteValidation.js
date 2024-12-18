"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAvailableForSuggestion = void 0;
const constants_1 = require("../constants");
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
    if (suggestionTimeSlot.start >= availabilitySlot.start && availabilitySlot.end - suggestionTimeSlot.start >= constants_1.hourMilliseconds) {
        return true;
    }
    ;
    if (suggestionTimeSlot.end <= availabilitySlot.end && suggestionTimeSlot.end - availabilitySlot.start >= constants_1.hourMilliseconds) {
        return true;
    }
    ;
    if (availabilitySlot.start >= suggestionTimeSlot.start && suggestionTimeSlot.end - availabilitySlot.start >= constants_1.hourMilliseconds) {
        return true;
    }
    ;
    return false;
}
;
