interface SuggestionTimeSlot {
  start: number,
  end: number,
};

interface AvailabilitySlot {
  start: number,
  end: number,
};

export function isAvailableForSuggestion(suggestionTimeSlot: SuggestionTimeSlot, availabilitySlots: AvailabilitySlot[]): boolean {
  if (availabilitySlots.length === 0) {
    return false;
  };

  for (const slot of availabilitySlots) {
    if (intersectsWithAvailabilitySlot(suggestionTimeSlot, slot)) {
      return true;
    };
  };

  return false;
};

function intersectsWithAvailabilitySlot(suggestionTimeSlot: SuggestionTimeSlot, availabilitySlot: AvailabilitySlot): boolean {
  const hourMilliseconds: number = 1000 * 60 * 60;

  //     --- --- --- ---   | suggestion slot
  // --- --- --- ---       | availability slot
  // OR
  //     --- --- ---       | suggestion slot
  // --- --- --- --- ---   | availability slot
  if (suggestionTimeSlot.start >= availabilitySlot.start && availabilitySlot.end - suggestionTimeSlot.start >= hourMilliseconds) {
    return true;
  };

  // --- --- --- ---       | suggestion slot
  //     --- --- --- ---   | availability slot
  if (suggestionTimeSlot.end <= availabilitySlot.end && suggestionTimeSlot.end - availabilitySlot.start >= hourMilliseconds) {
    return true;
  };

  // --- --- --- --- ---   | suggestion slot
  //     --- --- ---       | availability slot
  if (availabilitySlot.start >= suggestionTimeSlot.start && suggestionTimeSlot.end - availabilitySlot.start >= hourMilliseconds) {
    return true;
  };

  return false;
};