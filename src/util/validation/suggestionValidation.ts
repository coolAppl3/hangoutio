import { dayMilliseconds, hourMilliseconds } from "../constants";
import { containsInvalidWhitespace } from "../globalUtils";

export function isValidSuggestionTitle(title: string): boolean {
  if (typeof title !== 'string') {
    return false;
  };

  if (containsInvalidWhitespace(title)) {
    return false;
  };

  const titleRegex: RegExp = /^[-A-Za-z0-9 ()!?.]{3,40}$/;
  return titleRegex.test(title);
};

export function isValidSuggestionDescription(description: string): boolean {
  if (typeof description !== 'string') {
    return false;
  };

  if (description !== description.trim()) {
    return false;
  };

  const descriptionRegex: RegExp = /^[ -~\u20AC\r\n]{10,500}$/; // printable ASCII, euro symbol, and line breaks. 
  return descriptionRegex.test(description);
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