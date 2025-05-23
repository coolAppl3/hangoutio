import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE, MAX_HANGOUT_MEMBERS_LIMIT, MAX_HANGOUT_PERIOD_DAYS, MIN_HANGOUT_MEMBERS_LIMIT } from "../../global/clientConstants";
import { ConfirmModal } from "../../global/ConfirmModal";
import ErrorSpan from "../../global/ErrorSpan";
import { AsyncErrorData, getAsyncErrorData } from "../../global/errorUtils";
import { InfoModal } from "../../global/InfoModal";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import SliderInput from "../../global/SliderInput";
import { validateHangoutTitle, validateNewPassword } from "../../global/validation";
import { deleteHangoutService, ProgressHangoutStageData, progressHangoutStageService, updateHangoutMembersLimitService, updateHangoutPasswordService, UpdateHangoutStagesBody, updateHangoutStagesService, updateHangoutTitleService } from "../../services/hangoutServices";
import { renderDashboardSection } from "../dashboard/hangoutDashboard";
import { getHangoutStageTitle } from "../dashboard/hangoutDashboardUtils";
import { globalHangoutState } from "../globalHangoutState";
import { copyToClipboard } from "../globalHangoutUtils";
import { directlyNavigateHangoutSections, navigateHangoutSections } from "../hangoutNav";
import { hangoutSuggestionState, initHangoutSuggestions } from "../suggestions/hangoutSuggestions";
import { calculateStepMinimumSliderValue, handleNoSuggestionProgressionAttempt, isValidNewHangoutPeriods, resetMembersLimitSliderValues, resetSliderValues, resetStageSliderValues, toggleStagesSettingsButtons, updateSettingsButtons } from "./hangoutSettingsUtils";

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

const updateHangoutTitleForm: HTMLFormElement | null = document.querySelector('#hangout-settings-title-form');
const settingsTitleInput: HTMLInputElement | null = document.querySelector('#hangout-settings-title-input');
const updateTitleBtn: HTMLButtonElement | null = document.querySelector('#update-hangout-title-btn')


const updateHangoutPasswordForm: HTMLFormElement | null = document.querySelector('#hangout-settings-password-form');
const settingsPasswordInput: HTMLInputElement | null = document.querySelector('#hangout-settings-password-input');
const updatePasswordBtn: HTMLButtonElement | null = document.querySelector('#update-hangout-password-btn')

const progressHangoutBtn: HTMLButtonElement | null = document.querySelector('#progress-hangout-btn');

const currentStageSpan: HTMLSpanElement | null = document.querySelector('#settings-current-stage-span');
const membersCountSpan: HTMLSpanElement | null = document.querySelector('#settings-member-count-span');
const hangoutTitleSpan: HTMLSpanElement | null = document.querySelector('#settings-title-span');

const settingsPasswordPreviewer: HTMLSpanElement | null = document.querySelector('#settings-password-previewer');
const deleteHangoutPassword: HTMLButtonElement | null = document.querySelector('#delete-hangout-password-btn');

export function hangoutSettings(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-settings', async () => {
    if (!hangoutSuggestionState.isLoaded) {
      await initHangoutSuggestions();
    };

    initHangoutSettings();
  });

  settingsSectionElement?.addEventListener('click', handleHangoutSettingsClicks);

  updateHangoutTitleForm?.addEventListener('submit', updateHangoutTitle);
  updateHangoutPasswordForm?.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    updateHangoutPassword();
  });
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
    popup(`You're not the hangout leader.`, 'error');
    directlyNavigateHangoutSections('dashboard');

    LoadingModal.remove();
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
  setActiveValidation();

  LoadingModal.remove();
};

export function renderHangoutSettingsSection(): void {
  updateSliderValues();
  disablePassedStagesSliders();
  updateProgressBtn();
  updateCurrentStageSpan();
  updateMembersCount();
  updateHangoutTitleSpan();
  updateHangoutPasswordElements();

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

function updateMembersCount(): void {
  if (!hangoutSettingsState.sliders || !membersCountSpan) {
    return;
  };

  globalHangoutState.data && (membersCountSpan.textContent = `${globalHangoutState.data.hangoutMembers.length}`);
};

function updateCurrentStageSpan(): void {
  if (!globalHangoutState.data || !currentStageSpan) {
    return;
  };

  currentStageSpan.textContent = getHangoutStageTitle(globalHangoutState.data.hangoutDetails.current_stage);
};

function updateHangoutTitleSpan(): void {
  if (!globalHangoutState.data || !hangoutTitleSpan) {
    return;
  };

  hangoutTitleSpan.textContent = globalHangoutState.data.hangoutDetails.hangout_title;
};

function updateHangoutPasswordElements(): void {
  if (!globalHangoutState.data || !settingsPasswordPreviewer || !deleteHangoutPassword) {
    return;
  };

  const decryptedHangoutPassword: string | null = globalHangoutState.data.decryptedHangoutPassword;

  if (!decryptedHangoutPassword) {
    settingsPasswordPreviewer.classList.add('empty');
    settingsPasswordPreviewer.firstElementChild && (settingsPasswordPreviewer.firstElementChild.textContent = 'Not set');

    deleteHangoutPassword.classList.add('disabled');
    deleteHangoutPassword.disabled = true;

    return;
  };

  settingsPasswordPreviewer.classList.remove('empty');
  settingsPasswordPreviewer.firstElementChild && (settingsPasswordPreviewer.firstElementChild.textContent = '*************');

  deleteHangoutPassword.classList.remove('disabled');
  deleteHangoutPassword.disabled = false;
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
    await handleCopyHangoutPassword();
    return;
  };

  if (e.target.id === 'settings-password-reveal-btn') {
    revealHangoutPassword();
    return;
  };

  if (e.target.id === 'hangout-settings-password-input-reveal-btn') {
    togglePasswordInputReveal(e.target);
    return;
  };

  if (e.target.id === 'delete-hangout-password-btn') {
    confirmPasswordDelete();
    return;
  };

  if (e.target.id === 'delete-hangout-btn') {
    confirmDeleteHangout();
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

    hangoutDetails.availability_period = newAvailabilityPeriod;
    hangoutDetails.suggestions_period = newSuggestionsPeriod;
    hangoutDetails.voting_period = newVotingPeriod;

    renderHangoutSettingsSection();
    toggleStagesSettingsButtons();

    popup('Hangout stages updated.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

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

      renderHangoutSettingsSection();
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

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 409) {
      handleNoSuggestionProgressionAttempt();
      return;
    };

    if (status === 403) {
      hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
      hangoutDetails.is_concluded = true;

      renderHangoutSettingsSection();
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
  LoadingModal.display();

  if (!globalHangoutState.data || !hangoutSettingsState.sliders) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, hangoutDetails, hangoutMembers } = globalHangoutState.data;

  const currentMembersCount: number = hangoutMembers.length;
  const currentMembersLimit: number = hangoutDetails.members_limit;
  const newMembersLimit: number = hangoutSettingsState.sliders.membersLimitSlider.value;

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  if (newMembersLimit === currentMembersLimit) {
    updateSettingsButtons();

    popup(`Members limit is already set to ${currentMembersLimit}.`, 'success');
    LoadingModal.remove();

    return;
  };

  if (newMembersLimit < currentMembersCount) {
    popup(`New members limit can't be lower than the number of existing members.`, 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await updateHangoutMembersLimitService({ hangoutId, hangoutMemberId, newMembersLimit });

    hangoutDetails.members_limit = newMembersLimit;
    hangoutSettingsState.sliders.membersLimitSlider.updateValue(newMembersLimit);

    updateMembersCount();

    popup('Members limit updated.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong/.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 403) {
      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
      globalHangoutState.data.hangoutDetails.is_concluded = true;

      renderHangoutSettingsSection();
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

async function updateHangoutTitle(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (!globalHangoutState.data || !settingsTitleInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, isLeader, hangoutDetails } = globalHangoutState.data;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    LoadingModal.remove();

    directlyNavigateHangoutSections('dashboard');
    return;
  };

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidNewHangoutTitle: boolean = validateHangoutTitle(settingsTitleInput);

  if (!isValidNewHangoutTitle) {
    popup('Invalid new hangout title.', 'error');
    LoadingModal.remove();

    return;
  };

  const newTitle: string = settingsTitleInput.value;

  try {
    await updateHangoutTitleService({ hangoutId, hangoutMemberId, newTitle });

    hangoutDetails.hangout_title = newTitle;

    clearUpdateTitleForm();
    updateHangoutTitleSpan();

    popup('Hangout title updated.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400 && !errReason) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 409 || (status === 400 && errReason === 'invalidNewTitle')) {
      ErrorSpan.display(settingsTitleInput, errMessage);
      return;
    };

    if (status === 403) {
      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
      globalHangoutState.data.hangoutDetails.is_concluded = true;

      renderDashboardSection();
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

async function updateHangoutPassword(deletePassword: boolean = false): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data || !settingsPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, isLeader, hangoutDetails } = globalHangoutState.data;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    LoadingModal.remove();

    directlyNavigateHangoutSections('dashboard');
    return;
  };

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidNewPassword: boolean = deletePassword ? true : validateNewPassword(settingsPasswordInput);

  if (!isValidNewPassword) {
    popup('Invalid new hangout password.', 'error');
    LoadingModal.remove();

    return;
  };

  const newPassword: string | null = deletePassword ? null : settingsPasswordInput.value;

  try {
    await updateHangoutPasswordService({ hangoutId, hangoutMemberId, newPassword });

    globalHangoutState.data.decryptedHangoutPassword = newPassword;
    globalHangoutState.data.isPasswordProtected = !deletePassword;

    clearUpdatePasswordForm();
    updateHangoutPasswordElements();

    popup(deletePassword ? 'Password removed.' : 'Password updated.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400 && !errReason) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 403) {
      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
      globalHangoutState.data.hangoutDetails.is_concluded = true;

      renderHangoutSettingsSection();
      return;
    };

    if (status === 400) {
      ErrorSpan.display(settingsPasswordInput, errMessage);
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

async function deleteHangout(): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, isLeader } = globalHangoutState.data;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    directlyNavigateHangoutSections('dashboard');

    return;
  };

  try {
    await deleteHangoutService(hangoutMemberId, hangoutId);

    popup('Hangout deleted.', 'success');
    setTimeout(() => window.location.href = 'home', 1000);

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

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

function initSettingsSectionMutationObserver(): void {
  if (!settingsSectionElement) {
    return;
  };

  const mutationObserver: MutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class' && settingsSectionElement.classList.contains('hidden')) {
        resetSliderValues();
        hangoutSettingsState.settingsSectionMutationObserverActive = false;

        mutationObserver.disconnect();
        break;
      };
    };
  });

  mutationObserver.observe(settingsSectionElement, { attributes: true, attributeFilter: ['class'] });
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
    handleNoSuggestionProgressionAttempt();
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

async function handleCopyHangoutPassword(): Promise<void> {
  if (!globalHangoutState.data) {
    popup('Failed to copy hangout password.', 'error');
    return;
  };

  const { isLeader, decryptedHangoutPassword } = globalHangoutState.data;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    directlyNavigateHangoutSections('dashboard');

    return;
  };

  if (!decryptedHangoutPassword) {
    popup('Hangout is not password protected.', 'error');
    updateHangoutPasswordElements();

    return;
  };

  await copyToClipboard(decryptedHangoutPassword);
};

function revealHangoutPassword(): void {
  if (!globalHangoutState.data) {
    popup('Failed to reveal hangout password.', 'error');
    return;
  };

  const { isLeader, decryptedHangoutPassword } = globalHangoutState.data;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    directlyNavigateHangoutSections('dashboard');

    return;
  };

  if (!decryptedHangoutPassword) {
    popup('Hangout is not password protected.', 'error');
    updateHangoutPasswordElements();

    return;
  };

  InfoModal.display({
    title: 'Hangout password is: ',
    description: decryptedHangoutPassword,
    btnTitle: 'Hide',
  }, { simple: true });
};

function confirmPasswordDelete(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Are you sure you want to remove the hangout password?',
    description: 'This action will make your hangout less secure.',
    confirmBtnTitle: 'Remove password',
    cancelBtnTitle: 'Cancel',
    extraBtnTitle: null,
    isDangerousAction: true,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      ConfirmModal.remove();
      await updateHangoutPassword(true);

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};

function setActiveValidation(): void {
  settingsTitleInput?.addEventListener('input', () => {
    const isValidInput: boolean = validateHangoutTitle(settingsTitleInput);
    updateTitleBtn && toggleFormBtn(updateTitleBtn, isValidInput);
  });

  settingsPasswordInput?.addEventListener('input', () => {
    const isValidInput: boolean = validateNewPassword(settingsPasswordInput);
    updatePasswordBtn && toggleFormBtn(updatePasswordBtn, isValidInput);
  });
};

function toggleFormBtn(btn: HTMLButtonElement, enable: boolean): void {
  if (!enable) {
    btn.classList.add('disabled');
    btn.disabled = true;

    return;
  };

  btn.classList.remove('disabled');
  btn.disabled = false;
};

function clearUpdatePasswordForm(): void {
  if (!settingsPasswordInput) {
    return;
  };

  settingsPasswordInput.value = '';
  updatePasswordBtn && toggleFormBtn(updatePasswordBtn, false);

  settingsPasswordInput.blur();
  ErrorSpan.hide(settingsPasswordInput);
};

function clearUpdateTitleForm(): void {
  if (!settingsTitleInput) {
    return;
  };

  settingsTitleInput.value = '';
  updateTitleBtn && toggleFormBtn(updateTitleBtn, false);

  settingsTitleInput.blur();
  ErrorSpan.hide(settingsTitleInput);
};

function togglePasswordInputReveal(revealBtn: HTMLButtonElement): void {
  if (!revealBtn.previousElementSibling) {
    return;
  };

  if (revealBtn.classList.contains('revealed')) {
    revealBtn.classList.remove('revealed');
    revealBtn.previousElementSibling.setAttribute('type', 'password');

    return;
  };

  revealBtn.classList.add('revealed');
  revealBtn.previousElementSibling.setAttribute('type', 'text');
};

function confirmDeleteHangout(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Are you sure you want to delete this hangout?',
    description: 'This action is irreversible.',
    confirmBtnTitle: 'Delete hangout',
    cancelBtnTitle: 'Cancel',
    extraBtnTitle: null,
    isDangerousAction: true,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      ConfirmModal.remove();
      await deleteHangout();

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};