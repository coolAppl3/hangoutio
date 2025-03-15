import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE, MAX_HANGOUT_MEMBERS_LIMIT, MAX_HANGOUT_PERIOD_DAYS, MIN_HANGOUT_MEMBERS_LIMIT } from "../../global/clientConstants";
import { ConfirmModal } from "../../global/ConfirmModal";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import SliderInput from "../../global/SliderInput";
import { ProgressHangoutStageData, progressHangoutStageService, UpdateHangoutStagesBody, updateHangoutStagesService } from "../../services/hangoutServices";
import { globalHangoutState } from "../globalHangoutState";
import { directlyNavigateHangoutSections, navigateHangoutSections } from "../hangoutNav";
import { hangoutSuggestionState } from "../suggestions/hangoutSuggestions";
import { calculateStepMinimumSliderValue, handleProgressionAttemptWithoutSuggestions, isValidNewHangoutPeriods, resetMembersLimitSliderValues, resetSliderValues, resetStageSliderValues, toggleStagesSettingsButtons, updateSettingsButtons } from "./hangoutSettingsUtils";

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
const progressHangoutBtn: HTMLButtonElement | null = document.querySelector('#progress-hangout-btn');

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
    renderHangoutSettingsSection();
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

  renderHangoutSettingsSection();
  LoadingModal.remove();
};

function renderHangoutSettingsSection(): void {
  updateSliderValues();
  disablePassedStagesSliders();
  updateProgressBtn();

  if (!hangoutSettingsState.settingsSectionMutationObserverActive) {
    initSettingsSectionMutationObserver();
  };
};

function updateSliderValues(): void {
  if (!globalHangoutState.data || !hangoutSettingsState.sliders) {
    return;
  };

  const { availability_period, suggestions_period, voting_period, members_limit } = globalHangoutState.data.hangoutDetails;
  const { availabilityPeriodSlider, suggestionsPeriodSlider, votingPeriodSlider, membersLimitSlider } = hangoutSettingsState.sliders;

  availabilityPeriodSlider.updateValue(Math.ceil(availability_period / dayMilliseconds));
  suggestionsPeriodSlider.updateValue(Math.ceil(suggestions_period / dayMilliseconds));
  votingPeriodSlider.updateValue(Math.ceil(voting_period / dayMilliseconds));
  membersLimitSlider.updateValue(members_limit);
};

function disablePassedStagesSliders(): void {
  if (!globalHangoutState.data || !hangoutSettingsState.sliders) {
    return;
  };

  const current_stage: number = globalHangoutState.data.hangoutDetails.current_stage;
  const { availabilityPeriodSlider, suggestionsPeriodSlider, votingPeriodSlider } = hangoutSettingsState.sliders;

  current_stage > HANGOUT_AVAILABILITY_STAGE && availabilityPeriodSlider.disable();
  current_stage > HANGOUT_SUGGESTIONS_STAGE && suggestionsPeriodSlider.disable();
  current_stage > HANGOUT_VOTING_STAGE && votingPeriodSlider.disable();
};

function updateProgressBtn(): void {
  if (!globalHangoutState.data || !progressHangoutBtn) {
    return;
  };

  const { current_stage, is_concluded } = globalHangoutState.data.hangoutDetails;

  if (current_stage === HANGOUT_VOTING_STAGE) {
    progressHangoutBtn.textContent = 'Conclude hangout';
    return;
  };

  if (is_concluded) {
    progressHangoutBtn.classList.add('hidden');
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
    confirmProgressHangoutAction();
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
  LoadingModal.display();

  if (!globalHangoutState.data || !hangoutSettingsState.sliders) {
    popup('Something went wrong', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, isLeader, hangoutDetails } = globalHangoutState.data;
  const { availability_period, suggestions_period, voting_period, current_stage, stage_control_timestamp, is_concluded } = hangoutDetails;
  const { availabilityPeriodSlider, suggestionsPeriodSlider, votingPeriodSlider } = hangoutSettingsState.sliders;

  const newAvailabilityPeriod: number = current_stage > HANGOUT_AVAILABILITY_STAGE
    ? availability_period
    : availabilityPeriodSlider.value * dayMilliseconds;
  //

  const newSuggestionsPeriod: number = current_stage > HANGOUT_SUGGESTIONS_STAGE
    ? suggestions_period
    : suggestionsPeriodSlider.value * dayMilliseconds;
  //

  const newVotingPeriod: number = votingPeriodSlider.value * dayMilliseconds;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!isValidNewHangoutPeriods(
    { currentStage: current_stage, stageControlTimestamp: stage_control_timestamp },
    [availability_period, suggestions_period, voting_period],
    [newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod]
  )) {
    popup('Invalid new hangout stages configuration.', 'error');
    LoadingModal.remove();

    return;
  };

  const updateHangoutStagesBody: UpdateHangoutStagesBody = {
    hangoutId,
    hangoutMemberId,
    newAvailabilityPeriod,
    newSuggestionsPeriod,
    newVotingPeriod
  };

  try {
    const newConclusionTimestamp: number = (await updateHangoutStagesService(updateHangoutStagesBody)).data.newConclusionTimestamp;

    globalHangoutState.data.conclusionTimestamp = newConclusionTimestamp;
    hangoutSettingsState.unsavedStageChanges = false;

    availabilityPeriodSlider.updateValue(Math.ceil(availabilityPeriodSlider.value));
    suggestionsPeriodSlider.updateValue(Math.ceil(suggestionsPeriodSlider.value));
    votingPeriodSlider.updateValue(Math.ceil(votingPeriodSlider.value));

    renderHangoutSettingsSection
    toggleStagesSettingsButtons();

    popup('Hangout stages updated.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 409) {
      renderHangoutSettingsSection();
      return;
    };

    if (status === 403) {
      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
      globalHangoutState.data.hangoutDetails.is_concluded = true;

      return;
    };

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (status === 401) {
      if (errReason === 'notHangoutLeader') {
        globalHangoutState.data.isLeader = false;
        directlyNavigateHangoutSections('dashboard');

        return;
      };

      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
    };
  };
};

async function progressHangoutStage(): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data || !hangoutSettingsState.sliders) {
    popup('Something went wrong', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, isLeader, hangoutDetails } = globalHangoutState.data;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    const updatedHangoutDetails: ProgressHangoutStageData = (await progressHangoutStageService({ hangoutId, hangoutMemberId })).data;

    globalHangoutState.data.conclusionTimestamp = updatedHangoutDetails.conclusion_timestamp;
    hangoutDetails.availability_period = updatedHangoutDetails.availability_period;
    hangoutDetails.suggestions_period = updatedHangoutDetails.suggestions_period;
    hangoutDetails.voting_period = updatedHangoutDetails.voting_period;
    hangoutDetails.stage_control_timestamp = updatedHangoutDetails.stage_control_timestamp;
    hangoutDetails.current_stage = updatedHangoutDetails.current_stage;
    hangoutDetails.is_concluded = updatedHangoutDetails.is_concluded;

    renderHangoutSettingsSection();

    popup(`Hangout ${hangoutDetails.is_concluded ? 'concluded' : 'progressed'}.`, 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 409) {
      handleProgressionAttemptWithoutSuggestions();
      return;
    };

    if (status === 403) {
      hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
      hangoutDetails.is_concluded = true;

      return;
    };

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (status === 401) {
      if (errReason === 'notHangoutLeader') {
        globalHangoutState.data.isLeader = false;
        directlyNavigateHangoutSections('dashboard');

        return;
      };

      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
    };
  };
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

function confirmProgressHangoutAction(): void {
  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    return;
  };

  const { is_concluded, current_stage } = globalHangoutState.data.hangoutDetails;

  if (is_concluded) {
    return;
  };

  if (current_stage === HANGOUT_SUGGESTIONS_STAGE && hangoutSuggestionState.suggestions.length === 0) {
    handleProgressionAttemptWithoutSuggestions();
    return;
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: current_stage === HANGOUT_VOTING_STAGE
      ? 'Are you sure you want to conclude the hangout?'
      : 'Are you sure you want to progress the hangout?',
    description: 'This action is irreversible.',
    confirmBtnTitle: 'Confirm',
    cancelBtnTitle: 'Cancel',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      await progressHangoutStage();
      ConfirmModal.remove();

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};