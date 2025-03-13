import { dayMilliseconds, HANGOUT_CONCLUSION_STAGE, MAX_HANGOUT_MEMBERS_LIMIT, MAX_HANGOUT_PERIOD_DAYS, MIN_HANGOUT_MEMBERS_LIMIT, MIN_HANGOUT_PERIOD_DAYS } from "../constants";
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

function isValidHangoutPeriod(hangoutStep: number): boolean {
  if (!Number.isInteger(hangoutStep) || hangoutStep <= 0) {
    return false;
  };

  if (hangoutStep % dayMilliseconds !== 0) {
    return false;
  };

  const hangoutStepDays: number = hangoutStep / dayMilliseconds;
  if (hangoutStepDays < MIN_HANGOUT_PERIOD_DAYS || hangoutStepDays > MAX_HANGOUT_PERIOD_DAYS) {
    return false;
  };

  return true;
};

interface HangoutStageDetails {
  currentStage: number,
  stageControlTimestamp: number,
};

export function isValidNewHangoutPeriods(hangoutDetails: HangoutStageDetails, existingPeriods: number[], newPeriods: number[]): boolean {
  for (let i = 1; i <= 3; i++) {
    const newPeriod: number | undefined = newPeriods[i];
    const existingPeriod: number | undefined = existingPeriods[i];

    if (!newPeriod || !existingPeriod) {
      return false;
    };

    if (i < hangoutDetails.currentStage) {
      if (newPeriod !== existingPeriod) {
        return false;
      };

      continue;
    };

    if (!isValidHangoutPeriod(newPeriod)) {
      return false;
    };

    if (i === hangoutDetails.currentStage && newPeriod <= Date.now() - hangoutDetails.stageControlTimestamp) {
      return false;
    };
  };

  return true;
};