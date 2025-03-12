import { dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE, MAX_HANGOUT_MEMBERS_LIMIT, MAX_HANGOUT_PERIOD_DAYS, MIN_HANGOUT_MEMBERS_LIMIT } from "../../global/clientConstants";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import SliderInput from "../../global/SliderInput";
import { globalHangoutState } from "../globalHangoutState";
import { directlyNavigateHangoutSections, navigateHangoutSections } from "../hangoutNav";
import { calculateStepMinimumSliderValue, resetMembersLimitSliderValues, resetSliderValues, resetStageSliderValues, updateSettingsButtons } from "./settingsUtils";

interface HangoutSettingsState {
  isLoaded: boolean,
  settingsSectionMutationObserverActive: boolean,

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

export const hangoutSettingsState: HangoutSettingsState = {
  isLoaded: false,
  settingsSectionMutationObserverActive: false,

  unsavedStageChanges: false,
  unsavedMembersLimitChanges: false,
  hangoutPassword: null,

  sliders: null,
};

const settingsSectionElement: HTMLElement | null = document.querySelector('#settings-section');
const updateHangoutPasswordForm: HTMLFormElement | null = document.querySelector('#hangout-settings-password-form');

export function hangoutSettings(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-settings', initHangoutSettings);

  settingsSectionElement?.addEventListener('click', handleHangoutSettingsClicks);
  updateHangoutPasswordForm?.addEventListener('submit', updateHangoutPassword);
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
      'members-limit-input',
      'member',
      MIN_HANGOUT_MEMBERS_LIMIT,
      MAX_HANGOUT_MEMBERS_LIMIT,
      members_limit
    ),
  };

  document.addEventListener('availability-step-input_valueChange', updateSettingsButtons);
  document.addEventListener('suggestions-step-input_valueChange', updateSettingsButtons);
  document.addEventListener('voting-step-input_valueChange', updateSettingsButtons);
  document.addEventListener('members-limit-input_valueChange', updateSettingsButtons);

  renderHangoutSettings();
  LoadingModal.remove();
};

function renderHangoutSettings(): void {
  if (!hangoutSettingsState.settingsSectionMutationObserverActive) {
    initSettingsSectionMutationObserver();
  };
};

async function handleHangoutSettingsClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'stages-settings-apply-btn') {
    await updateHangoutStages();
    return;
  };

  if (e.target.id === 'stages-settings-reset-btn') {
    resetStageSliderValues();
    return;
  };

  if (e.target.id === 'progress-hangout-btn') {
    await progressHangout();
    return;
  };

  if (e.target.id === 'members-limit-settings-apply-btn') {
    await updateHangoutMembersLimit();
    return;
  };

  if (e.target.id === 'members-limit-settings-reset-btn') {
    resetMembersLimitSliderValues();
    return;
  };

  if (e.target.getAttribute('data-goTo')) {
    navigateHangoutSections(e);
    return;
  };

  if (e.target.id === 'settings-password-copy-btn') {
    // TODO: implement
    return;
  };

  if (e.target.id === 'hangout-settings-password-input-reveal-btn') {
    // TODO: implement
    return;
  };

  if (e.target.id === 'delete-hangout-password-btn') {
    // TODO: implement
  };
};

async function updateHangoutStages(): Promise<void> {
  // TODO: implement
};

async function progressHangout(): Promise<void> {
  // TODO: implement
};

async function updateHangoutMembersLimit(): Promise<void> {
  // TODO: implement
};

async function updateHangoutPassword(): Promise<void> {
  // TODO: implement
};

function initSettingsSectionMutationObserver(): void {
  if (!settingsSectionElement) {
    return;
  };

  const observer: MutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class' && settingsSectionElement.classList.contains('hidden')) {
        resetSliderValues();
        hangoutSettingsState.settingsSectionMutationObserverActive = false;

        observer.disconnect();
        break;
      };
    };
  });

  observer.observe(settingsSectionElement, { attributes: true, attributeFilter: ['class'], subtree: false });
  hangoutSettingsState.settingsSectionMutationObserverActive = true;
};