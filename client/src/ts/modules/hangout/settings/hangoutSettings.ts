import { dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE, MAX_HANGOUT_MEMBERS_LIMIT, MAX_HANGOUT_PERIOD_DAYS, MIN_HANGOUT_MEMBERS_LIMIT, MIN_HANGOUT_PERIOD_DAYS } from "../../global/clientConstants";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import SliderInput from "../../global/SliderInput";
import { globalHangoutState } from "../globalHangoutState";
import { directlyNavigateHangoutSections } from "../hangoutNav";

interface HangoutSettingsState {
  isLoaded: boolean,

  unsavedStageChanges: boolean,
  unsavedMembersLimitChanges: boolean,
  hangoutPassword: string | null,

  sliders: null | {
    availabilityPeriodSlider: SliderInput,
    suggestionsPeriodSlider: SliderInput,
    votingPeriodSlider: SliderInput,
    membersLimitSlider: SliderInput,
  },
};

const hangoutSettingsState: HangoutSettingsState = {
  isLoaded: false,

  unsavedStageChanges: false,
  unsavedMembersLimitChanges: false,
  hangoutPassword: null,

  sliders: null,
};

export function hangoutSettings(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-settings', initHangoutSettings);
};

function initHangoutSettings(): void {
  if (hangoutSettingsState.isLoaded) {
    renderHangoutSettings();
    return;
  };

  if (!globalHangoutState.data) {
    popup('Failed to load hangout settings.', 'error');
    return;
  };

  LoadingModal.display();

  const { hangoutDetails, isLeader, decryptedHangoutPassword } = globalHangoutState.data;
  const { current_stage, stage_control_timestamp, availability_period, suggestions_period, voting_period, members_limit } = hangoutDetails;

  if (!isLeader) {
    popup('Only the hangout leader can edit the hangout.', 'error');
    directlyNavigateHangoutSections('dashboard');

    return;
  };

  hangoutSettingsState.isLoaded = true;
  hangoutSettingsState.hangoutPassword = decryptedHangoutPassword;

  hangoutSettingsState.sliders = {
    availabilityPeriodSlider: new SliderInput(
      'availability-step-input',
      'day',
      calculateStepMinimumSliderValue(availability_period, current_stage, stage_control_timestamp),
      MAX_HANGOUT_PERIOD_DAYS,
      Math.ceil(availability_period / dayMilliseconds),
      current_stage > HANGOUT_AVAILABILITY_STAGE
    ),

    suggestionsPeriodSlider: new SliderInput(
      'suggestions-step-input',
      'day',
      calculateStepMinimumSliderValue(suggestions_period, current_stage, stage_control_timestamp),
      MAX_HANGOUT_PERIOD_DAYS,
      Math.ceil(suggestions_period / dayMilliseconds),
      current_stage > HANGOUT_SUGGESTIONS_STAGE
    ),

    votingPeriodSlider: new SliderInput(
      'voting-step-input',
      'day',
      calculateStepMinimumSliderValue(voting_period, current_stage, stage_control_timestamp),
      MAX_HANGOUT_PERIOD_DAYS,
      Math.ceil(voting_period / dayMilliseconds),
      current_stage > HANGOUT_VOTING_STAGE
    ),

    membersLimitSlider: new SliderInput(
      'member-limit-input',
      'member',
      MIN_HANGOUT_MEMBERS_LIMIT,
      MAX_HANGOUT_MEMBERS_LIMIT,
      members_limit
    ),
  };

  renderHangoutSettings();
  LoadingModal.remove();
};

function renderHangoutSettings(): void {
  // TODO: implement
};

function calculateStepMinimumSliderValue(stage: number, currentStage: number, stageControlTimestamp: number): number {
  if (stage < currentStage) {
    return Math.round(stage / dayMilliseconds);
  };

  if (currentStage === stage) {
    return Math.ceil((Date.now() - stageControlTimestamp) / dayMilliseconds);
  };

  return MIN_HANGOUT_PERIOD_DAYS;
};