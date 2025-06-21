import { dayMilliseconds, MAX_HANGOUT_MEMBERS_LIMIT, MAX_HANGOUT_PERIOD_DAYS, MIN_HANGOUT_MEMBERS_LIMIT, MIN_HANGOUT_PERIOD_DAYS } from "../constants";
import { containsInvalidWhitespace } from "../globalUtils";

export function isValidHangoutId(hangoutId: string): boolean {
  if (typeof hangoutId !== 'string') {
    return false;
  };

  if (hangoutId.length !== 46) {
    return false;
  };

  if (!hangoutId.startsWith('h')) {
    return false;
  };

  if (hangoutId[32] !== '_') {
    return false;
  };

  if (!isValidTimestamp(+hangoutId.substring(33))) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9_]{46,}$/;
  return regex.test(hangoutId);
};

export function isValidHangoutTitle(title: string): boolean {
  if (typeof title !== 'string') {
    return false;
  };

  if (containsInvalidWhitespace(title)) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z ]{3,25}$/;
  return regex.test(title);
};

export function isValidHangoutMembersLimit(limit: number): boolean {
  if (!Number.isInteger(limit)) {
    return false;
  };

  if (limit < MIN_HANGOUT_MEMBERS_LIMIT || limit > MAX_HANGOUT_MEMBERS_LIMIT) {
    return false;
  };

  return true;
};

function isValidTimestamp(timestamp: number): boolean {
  const timeStampLength: number = 13; // will work till 2268 AD

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

export function isValidHangoutPeriods(hangoutPeriods: number[]): boolean {
  if (hangoutPeriods.length !== 3) {
    return false;
  };

  for (let i = 0; i < hangoutPeriods.length; i++) {
    const period: number | undefined = hangoutPeriods[i];

    if (!period || !isValidHangoutPeriod(period)) {
      return false;
    };
  };

  return true;
};

function isValidHangoutPeriod(hangoutPeriod: number): boolean {
  if (!Number.isInteger(hangoutPeriod) || hangoutPeriod <= 0) {
    return false;
  };

  if (hangoutPeriod % dayMilliseconds !== 0) {
    return false;
  };

  const hangoutPeriodDays: number = hangoutPeriod / dayMilliseconds;
  if (hangoutPeriodDays < MIN_HANGOUT_PERIOD_DAYS || hangoutPeriodDays > MAX_HANGOUT_PERIOD_DAYS) {
    return false;
  };

  return true;
};

interface HangoutStageDetails {
  currentStage: number,
  stageControlTimestamp: number,
};

export function isValidNewHangoutPeriods(hangoutStageDetails: HangoutStageDetails, existingPeriods: number[], newPeriods: number[]): boolean {
  for (let i = 0; i < 3; i++) {
    const existingPeriod: number | undefined = existingPeriods[i];
    const newPeriod: number | undefined = newPeriods[i];

    if (!existingPeriod || !newPeriod) {
      return false;
    };

    if (i + 1 < hangoutStageDetails.currentStage) {
      if (newPeriod !== existingPeriod) {
        return false;
      };

      continue;
    };

    if (!isValidHangoutPeriod(newPeriod)) {
      return false;
    };

    if (i + 1 === hangoutStageDetails.currentStage && newPeriod <= Date.now() - hangoutStageDetails.stageControlTimestamp) {
      return false;
    };
  };

  return true;
};