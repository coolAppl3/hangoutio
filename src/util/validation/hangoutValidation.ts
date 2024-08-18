export const hangoutMemberLimit: number = 20;
export const ongoingHangoutsLimit: number = 30;

export function isValidHangoutIDString(hangoutID: string): boolean {
  if (typeof hangoutID !== 'string') {
    return false;
  };

  if (hangoutID.length < 46) {
    return false;
  };

  if (hangoutID[32] !== '_') {
    return false;
  };

  if (!Number.isInteger(+hangoutID.substring(33))) {
    return false;
  };

  if (!hangoutID.startsWith('h')) {
    return false;
  };

  return true;
};

export function isValidHangoutMemberLimit(limit: number): boolean {
  if (!Number.isInteger(limit)) {
    return false;
  };

  if (limit < 2 || limit > hangoutMemberLimit) {
    return false;
  };

  return true;
};

function isValidStep(hangoutStep: number): boolean {
  if (!Number.isInteger(hangoutStep)) {
    return false;
  };

  const dayMilliseconds: number = 1000 * 60 * 60 * 24;
  if (hangoutStep % dayMilliseconds !== 0) {
    return false;
  };

  const hangoutStepDays: number = hangoutStep / dayMilliseconds;
  if (hangoutStepDays < 1 || hangoutStepDays > 7) {
    return false;
  };

  return true;
};

export function isValidHangoutSteps(currentStep: number, hangoutSteps: number[]): boolean {
  if (hangoutSteps.length === 0) {
    return false;
  };

  for (let i = 0; i < hangoutSteps.length; i++) {
    if (i < --currentStep) {
      continue;
    };

    if (!isValidStep(hangoutSteps[i])) {
      return false;
    };
  };

  return true;
};

interface HangoutDetails {
  availability_step: number,
  suggestions_step: number,
  voting_step: number,
  current_step: number,
  current_step_timestamp: number,
};

interface NewSteps {
  newAvailabilityStep: number,
  newSuggestionsStep: number,
  newVotingStep: number,
};

export function isValidNewHangoutSteps(hangoutDetails: HangoutDetails, newSteps: NewSteps): boolean {
  for (const stepKey in newSteps) {
    if (!Number.isInteger(newSteps[stepKey as keyof NewSteps])) {
      return false;
    };
  };

  if (noStepChange(hangoutDetails, newSteps)) {
    return false;
  };

  const currentTimestamp: number = Date.now();

  if (hangoutDetails.current_step === 1) {
    if (getStepEndTimestamp(hangoutDetails.current_step_timestamp, newSteps.newAvailabilityStep) <= currentTimestamp) {
      return false;
    };
  };

  if (hangoutDetails.current_step === 2) {
    if (newSteps.newAvailabilityStep !== hangoutDetails.availability_step) {
      return false;
    };

    if (getStepEndTimestamp(hangoutDetails.current_step_timestamp, newSteps.newSuggestionsStep) <= currentTimestamp) {
      return false;
    };
  };

  if (hangoutDetails.current_step === 3) {
    if (newSteps.newAvailabilityStep !== hangoutDetails.availability_step) {
      return false;
    };

    if (newSteps.newSuggestionsStep !== hangoutDetails.suggestions_step) {
      return false;
    };

    if (getStepEndTimestamp(hangoutDetails.current_step_timestamp, newSteps.newVotingStep) <= currentTimestamp) {
      return false;
    };
  };

  return true;
};

function noStepChange(hangoutDetails: HangoutDetails, newSteps: NewSteps): boolean {
  if (
    newSteps.newAvailabilityStep === hangoutDetails.availability_step &&
    newSteps.newSuggestionsStep === hangoutDetails.suggestions_step &&
    newSteps.newVotingStep === hangoutDetails.voting_step
  ) {
    return true;
  };

  return false;
};

function getStepEndTimestamp(currentStepTimestamp: number, stepLength: number): number {
  return currentStepTimestamp + stepLength;
};