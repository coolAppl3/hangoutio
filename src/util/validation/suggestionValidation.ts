import { hourMilliseconds } from "../constants";
import { containsInvalidWhitespace } from "../globalUtils";

export function isValidSuggestionTitle(title: string): boolean {
  if (typeof title !== 'string') {
    return false;
  };

  if (containsInvalidWhitespace(title)) {
    return false;
  };

  const regex: RegExp = /^[-A-Za-z0-9 ()!?.]{3,40}$/;
  return regex.test(title);
};

export function isValidSuggestionDescription(description: string): boolean {
  if (typeof description !== 'string') {
    return false;
  };

  if (description.trim() !== description) {
    return false;
  };

  const regex: RegExp = /^[ -~\r\n]{10,500}$/;
  return regex.test(description);
};

export function isValidSuggestionTimeSlot(slotStart: number, slotEnd: number): boolean {
  if (!isValidTimestamp(slotStart) || !isValidTimestamp(slotEnd)) {
    return false;
  };

  const slotLength: number = slotEnd - slotStart;
  if (slotLength < hourMilliseconds || slotLength > hourMilliseconds * 24) {
    return false;
  };

  return true;
};

export function isValidSuggestionSlotStart(hangoutConclusionTimestamp: number, slotStart: number): boolean {
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