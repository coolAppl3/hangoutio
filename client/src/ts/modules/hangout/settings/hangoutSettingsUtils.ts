import { dayMilliseconds, MAX_HANGOUT_PERIOD_DAYS, MIN_HANGOUT_PERIOD_DAYS } from "../../global/clientConstants";
import { InfoModal } from "../../global/InfoModal";
import { hangoutSettingsState } from "./hangoutSettings";

const stagesSettingsApplyBtn: HTMLButtonElement | null = document.querySelector('#stages-settings-apply-btn');
const stagesSettingsResetBtn: HTMLButtonElement | null = document.querySelector('#stages-settings-reset-btn');

const membersLimitSettingsApplyBtn: HTMLButtonElement | null = document.querySelector('#members-limit-settings-apply-btn');
const membersLimitSettingsResetBtn: HTMLButtonElement | null = document.querySelector('#members-limit-settings-reset-btn');

export function updateSettingsButtons(): void {
  if (!hangoutSettingsState.sliders) {
    return;
  };

  const { availabilityPeriodSlider, suggestionsPeriodSlider, votingPeriodSlider, membersLimitSlider } = hangoutSettingsState.sliders;

  if (
    availabilityPeriodSlider.value !== availabilityPeriodSlider.initialValue ||
    suggestionsPeriodSlider.value !== suggestionsPeriodSlider.initialValue ||
    votingPeriodSlider.value !== votingPeriodSlider.initialValue
  ) {
    hangoutSettingsState.unsavedStageChanges = true;
    toggleStagesSettingsButtons();

  } else {
    hangoutSettingsState.unsavedStageChanges = false;
    toggleStagesSettingsButtons();
  };

  if (membersLimitSlider.value !== membersLimitSlider.initialValue) {
    hangoutSettingsState.unsavedMembersLimitChanges = true;
    toggleMembersLimitSettingsButtons();

  } else {
    hangoutSettingsState.unsavedMembersLimitChanges = false;
    toggleMembersLimitSettingsButtons();
  };
};

export function toggleStagesSettingsButtons(): void {
  if (!stagesSettingsApplyBtn || !stagesSettingsResetBtn) {
    return;
  };

  if (hangoutSettingsState.unsavedStageChanges) {
    stagesSettingsApplyBtn.classList.remove('disabled');
    stagesSettingsApplyBtn.disabled = false;

    stagesSettingsResetBtn.classList.remove('hidden');
    return;
  };

  stagesSettingsApplyBtn.classList.add('disabled');
  stagesSettingsApplyBtn.disabled = true;

  stagesSettingsResetBtn.classList.add('hidden');
};

export function toggleMembersLimitSettingsButtons(): void {
  if (!membersLimitSettingsApplyBtn || !membersLimitSettingsResetBtn) {
    return;
  };

  if (hangoutSettingsState.unsavedMembersLimitChanges) {
    membersLimitSettingsApplyBtn.classList.remove('disabled');
    membersLimitSettingsApplyBtn.disabled = false;

    membersLimitSettingsResetBtn.classList.remove('hidden');
    return;
  };

  membersLimitSettingsApplyBtn.classList.add('disabled');
  membersLimitSettingsApplyBtn.disabled = true;

  membersLimitSettingsResetBtn.classList.add('hidden');
};

export function calculateStepMinimumSliderValue(stage: number, currentStage: number, stageControlTimestamp: number): number {
  if (stage < currentStage) {
    return Math.round(stage / dayMilliseconds);
  };

  if (currentStage === stage) {
    return Math.ceil((Date.now() - stageControlTimestamp) / dayMilliseconds);
  };

  return MIN_HANGOUT_PERIOD_DAYS;
};

export function resetSliderValues(): void {
  resetStageSliderValues();
  resetMembersLimitSliderValues();
};

export function resetStageSliderValues(): void {
  if (!hangoutSettingsState.sliders) {
    return;
  };

  hangoutSettingsState.sliders.availabilityPeriodSlider.resetValues();
  hangoutSettingsState.sliders.suggestionsPeriodSlider.resetValues();
  hangoutSettingsState.sliders.votingPeriodSlider.resetValues();

  hangoutSettingsState.unsavedStageChanges = false;
};

export function resetMembersLimitSliderValues(): void {
  if (!hangoutSettingsState.sliders) {
    return;
  };

  hangoutSettingsState.sliders.membersLimitSlider.resetValues();
  hangoutSettingsState.unsavedMembersLimitChanges = false;
};

interface HangoutStageDetails {
  currentStage: number,
  stageControlTimestamp: number,
};

export function isValidNewHangoutPeriods(hangoutStageDetails: HangoutStageDetails, existingPeriods: number[], newPeriods: number[]): boolean {
  for (let i = 0; i < 3; i++) {
    const existingPeriod: number | undefined = existingPeriods[i];
    const newPeriod: number | undefined = newPeriods[i];

    if (!newPeriod || !existingPeriod) {
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

function isValidHangoutPeriod(hangoutStage: number): boolean {
  if (hangoutStage <= 0) {
    return false;
  };

  if (hangoutStage % dayMilliseconds !== 0) {
    return false;
  };

  const hangoutStageDays: number = hangoutStage / dayMilliseconds;
  if (hangoutStageDays < MIN_HANGOUT_PERIOD_DAYS || hangoutStageDays > MAX_HANGOUT_PERIOD_DAYS) {
    return false;
  };

  return true;
};

export function handleNoSuggestionProgressionAttempt(): void {
  InfoModal.display({
    title: 'No suggestions added yet.',
    description: `You can't progress the hangout into the voting stage without any suggestions.`,
    btnTitle: 'Okay',
  }, { simple: true });
};