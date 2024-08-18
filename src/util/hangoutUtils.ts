export const hangoutStepsMap: Map<number, string> = new Map();
hangoutStepsMap.set(1, 'availability_step');
hangoutStepsMap.set(2, 'suggestions_step');
hangoutStepsMap.set(3, 'voting_step');


export function getConclusionTimestamp(
  createdOnTimestamp: number,
  availabilityStep: number,
  suggestionsStep: number,
  votingStep: number
): number {
  const conclusionTimestamp = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;
  return conclusionTimestamp;
};

export function getNextStepTimestamp(
  currentStep: number,
  currentStepTimestamp: number,
  availabilityStep: number,
  suggestionsStep: number,
  votingStep: number
): number | null {
  if (currentStep === 1) {
    return currentStepTimestamp + availabilityStep;
  };

  if (currentStep === 2) {
    return currentStepTimestamp + suggestionsStep;
  };

  if (currentStep === 3) {
    return currentStepTimestamp + votingStep;
  };

  return null;
};

export function getCurrentStepName(currentStep: number): string {
  const steps: string[] = ['availability', 'suggestions', 'voting'];
  const currentStepName: string = steps[--currentStep];

  return currentStepName;
};