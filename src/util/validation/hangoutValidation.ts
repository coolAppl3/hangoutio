export function isValidHangoutIDString(hangoutID: string): boolean {
  if (typeof hangoutID !== 'string') {
    return false;
  };

  if (hangoutID.length !== 32) {
    return false;
  };

  if (!hangoutID.startsWith('h')) {
    return false;
  };

  return true;
};

export function isValidHangoutConfiguration(availabilityPeriod: number, suggestionsPeriod: number, votingPeriod: number): boolean {
  if (availabilityPeriod < 1 || availabilityPeriod > 7) {
    return false;
  };

  if (suggestionsPeriod < 1 || suggestionsPeriod > 14) {
    return false;
  };

  if (votingPeriod < 1 || votingPeriod > 14) {
    return false;
  };

  if (
    !Number.isInteger(availabilityPeriod) ||
    !Number.isInteger(suggestionsPeriod) ||
    !Number.isInteger(votingPeriod)
  ) {
    return false;
  };

  return true;
};

export function isValidHangoutMemberLimit(limit: number): boolean {

  if (!Number.isInteger(limit)) {
    return false;
  };

  if (limit < 2 || limit > 20) {
    return false;
  };

  return true;
};

interface HangoutDetails {
  currentStep: number,
  stepTimestamp: number,
  currentAvailabilityPeriod: number,
  currentSuggestionsPeriod: number,
  currentVotingPeriod: number,
};

interface NewPeriods {
  newAvailabilityPeriod: number,
  newSuggestionsPeriod: number,
  newVotingPeriod: number,
};

export function isValidNewPeriods(hangoutDetails: HangoutDetails, newPeriods: NewPeriods): boolean {
  const daysPassed: number = getDaysPassed(hangoutDetails.stepTimestamp);

  if (hangoutDetails.currentStep === 1) {

    if (newPeriods.newAvailabilityPeriod < daysPassed || newPeriods.newAvailabilityPeriod === daysPassed) {
      return false;
    };
  };

  if (hangoutDetails.currentStep === 2) {
    if (newPeriods.newAvailabilityPeriod !== hangoutDetails.currentAvailabilityPeriod) {
      return false;
    };

    if (newPeriods.newSuggestionsPeriod < daysPassed || newPeriods.newSuggestionsPeriod === daysPassed) {
      return false;
    };
  };

  if (hangoutDetails.currentStep === 3) {
    if (newPeriods.newAvailabilityPeriod !== hangoutDetails.currentAvailabilityPeriod) {
      return false;
    };

    if (newPeriods.newSuggestionsPeriod !== hangoutDetails.currentSuggestionsPeriod) {
      return false;
    };

    if (newPeriods.newVotingPeriod < daysPassed || newPeriods.newVotingPeriod === daysPassed) {
      return false;
    };
  };

  return true;
};

function getDaysPassed(stepTimeStamp: number): number {
  const dayMilliseconds: number = 1000 * 60 * 60 * 24;
  const daysPassed: number = Math.floor((Date.now() - stepTimeStamp) / dayMilliseconds);

  return daysPassed;
};