import { dayMilliseconds, hourMilliseconds, minuteMilliseconds } from "../constants";

export function isValidAvailabilitySlot(slotStart: number, slotEnd: number): boolean {
  if (!isValidTimestamp(slotStart) || !isValidTimestamp(slotEnd)) {
    return false;
  };

  const slotLength: number = slotEnd - slotStart;
  if (slotLength < hourMilliseconds || slotLength > hourMilliseconds * 24) {
    return false;
  };

  return true;
};

export function isValidAvailabilitySlotStart(hangoutConclusionTimestamp: number, slotStart: number): boolean {
  const halfYearMilliseconds: number = (dayMilliseconds * 365) / 2;

  if (!isValidTimestamp(hangoutConclusionTimestamp) || !isValidTimestamp(slotStart)) {
    return false;
  };

  if (slotStart < hangoutConclusionTimestamp) {
    return false;
  };

  if (slotStart - hangoutConclusionTimestamp > halfYearMilliseconds) {
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

interface ExistingAvailabilitySlot {
  slot_start_timestamp: number,
  slot_end_timestamp: number,
};

interface NewAvailabilitySlot {
  slotStartTimestamp: number,
  slotEndTimestamp: number,
};

export function intersectsWithExistingSlots(existingSlots: ExistingAvailabilitySlot[], newSlot: NewAvailabilitySlot): boolean {
  if (existingSlots.length === 0) {
    return false;
  };

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
  if (Math.abs(newSlotPart - slot.slot_start_timestamp) < minuteMilliseconds) {
    return true;
  };

  if (Math.abs(newSlotPart - slot.slot_end_timestamp) < minuteMilliseconds) {
    return true;
  };

  return false;
};