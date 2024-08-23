export const availabilitySlotsLimit: number = 10;

export function isValidAvailabilitySlot(hangoutConclusionTimestamp: number, slotStart: number, slotEnd: number): boolean {
  const hourMilliseconds: number = 1000 * 60 * 60;
  const yearMilliseconds: number = hourMilliseconds * 24 * 365;

  if (
    !isValidTimestamp(hangoutConclusionTimestamp) ||
    !isValidTimestamp(slotStart) ||
    !isValidTimestamp(slotEnd)
  ) {
    return false;
  };

  if (slotStart < hangoutConclusionTimestamp) {
    return false;
  };

  if (slotStart - hangoutConclusionTimestamp > yearMilliseconds) {
    return false;
  };

  return true;
};

function isValidTimestamp(timestamp: number): boolean {
  const timeStampLength: number = 13;

  if (!Number.isInteger(timestamp)) {
    return false;
  };

  if (timestamp.toString().length !== timeStampLength) {
    return false;
  };

  if (timestamp < 0) {
    return false;
  };

  return true;
};

export function isInitiallyValidAvailabilitySlot(slotStart: number, slotEnd: number): boolean {
  if (!isValidTimestamp(slotStart) || !isValidTimestamp(slotEnd)) {
    return false;
  };

  const hourMilliseconds: number = 1000 * 60 * 60;

  const slotLength: number = slotEnd - slotStart;
  if (slotLength < hourMilliseconds || slotLength > hourMilliseconds * 24) {
    return false;
  };

  return true;
};

interface ExistingAvailabilitySlot {
  slot_start_timestamp: number,
  slot_end_timestamp: number,
};

interface NewAvailabilitySlot {
  slotStartTimestamp: number,
  slotEndTimestamp: number,
};

export function intersectsWithExistingSlots(existingSlots: ExistingAvailabilitySlot[], newSlot: NewAvailabilitySlot): boolean {
  for (const slot of existingSlots) {
    if (isWithinExistingSlot(slot, newSlot.slotStartTimestamp) || isWithinExistingSlot(slot, newSlot.slotEndTimestamp)) {
      return true;
    };

    if (isCloserThanAMinute(slot, newSlot.slotStartTimestamp) || isCloserThanAMinute(slot, newSlot.slotEndTimestamp)) {
      return true;
    };
  };

  return false;
};

function isWithinExistingSlot(slot: ExistingAvailabilitySlot, newSlotPart: number): boolean {
  if (newSlotPart >= slot.slot_start_timestamp && newSlotPart <= slot.slot_end_timestamp) {
    return true;
  };

  return false;
};

function isCloserThanAMinute(slot: ExistingAvailabilitySlot, newSlotPart: number): boolean {
  const minuteMillisecond: number = 1000 * 60;

  if (Math.abs(newSlotPart - slot.slot_start_timestamp) < minuteMillisecond) {
    return true;
  };

  if (Math.abs(newSlotPart - slot.slot_end_timestamp) < minuteMillisecond) {
    return true;
  };

  return false;
};