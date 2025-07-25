import { hourMilliseconds } from "../constants";
import { AvailabilitySlot } from "../hangoutTypes";
import { isValidTimestamp } from "./hangoutValidation";

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
  if (slotStart < hangoutConclusionTimestamp) {
    return false;
  };

  const dateObj: Date = new Date(hangoutConclusionTimestamp);
  const furthestPossibleTimestamp: number = dateObj.setMonth(dateObj.getMonth() + 6);

  if (slotStart > furthestPossibleTimestamp) {
    return false;
  };

  return true;
};

interface NewAvailabilitySlotTimestamps {
  slotStartTimestamp: number,
  slotEndTimestamp: number,
};

export function overlapsWithExistingAvailabilitySlots(existingSlots: AvailabilitySlot[], newSlotTimestamps: NewAvailabilitySlotTimestamps): AvailabilitySlot | null {
  if (existingSlots.length === 0) {
    return null;
  };

  for (const existingSlot of existingSlots) {
    if (existingSlot.slot_start_timestamp >= newSlotTimestamps.slotStartTimestamp && existingSlot.slot_start_timestamp <= newSlotTimestamps.slotEndTimestamp) {
      return existingSlot;
    };

    if (existingSlot.slot_end_timestamp >= newSlotTimestamps.slotStartTimestamp && existingSlot.slot_end_timestamp <= newSlotTimestamps.slotEndTimestamp) {
      return existingSlot;
    };

    if (existingSlot.slot_start_timestamp <= newSlotTimestamps.slotStartTimestamp && existingSlot.slot_end_timestamp >= newSlotTimestamps.slotEndTimestamp) {
      return existingSlot;
    };
  };

  return null;
};