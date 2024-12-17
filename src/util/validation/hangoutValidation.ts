import { dayMilliseconds, HANGOUT_CONCLUSION_STAGE, MAX_HANGOUT_MEMBERS_LIMIT, MAX_HANGOUT_PERIOD_DAYS, MIN_HANGOUT_MEMBERS_LIMIT, MIN_HANGOUT_PERIOD_DAYS } from "../constants";

export function isValidHangoutId(hangoutId: string): boolean { // will work till 2268 AD ;)
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

  if (hangoutId.substring(33).length !== 13 || !isValidTimestamp(+hangoutId.substring(33))) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9_]{46,}$/;
  return regex.test(hangoutId);
};

export function isValidHangoutTitle(title: string): boolean {
  if (typeof title !== 'string') {
    return false;
  };

  if (title.trim() !== title) {
    return false;
  };

  const doubleSpacesRemoved: string = title.split(' ').filter((char: string) => char !== '').join(' ');
  if (title !== doubleSpacesRemoved) {
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

export function isValidHangoutPeriods(hangoutPeriods: number[]): boolean {
  if (hangoutPeriods.length !== 3) {
    return false;
  };

  for (let i = 0; i < hangoutPeriods.length; i++) {
    if (!isValidHangoutPeriod(hangoutPeriods[i])) {
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

interface HangoutDetails {
  currentStage: number,
  stageControlTimestamp: number,
};

export function isValidNewHangoutPeriods(hangoutDetails: HangoutDetails, existingPeriods: number[], newPeriods: number[]): boolean {
  if (hangoutDetails.currentStage === HANGOUT_CONCLUSION_STAGE) {
    return false;
  };

  for (let i = 1; i <= 3; i++) {
    if (i < hangoutDetails.currentStage) {
      if (newPeriods[i] !== existingPeriods[i]) {
        return false;
      };

      continue;
    };

    if (!isValidHangoutPeriod(newPeriods[i])) {
      return false;
    };

    if (i === hangoutDetails.currentStage && newPeriods[i] <= hangoutDetails.stageControlTimestamp) {
      return false;
    };
  };

  return true;
};