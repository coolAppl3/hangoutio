import { dayMilliseconds, MIN_HANGOUT_PERIOD_DAYS } from "../../global/clientConstants";
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

function toggleStagesSettingsButtons(): void {
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

function toggleMembersLimitSettingsButtons(): void {
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