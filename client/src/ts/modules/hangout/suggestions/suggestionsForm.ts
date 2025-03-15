import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_LIMIT, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE } from "../../global/clientConstants";
import ErrorSpan from "../../global/ErrorSpan";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { validateSuggestionDescription, validateSuggestionTitle } from "../../global/validation";
import { AddHangoutSuggestionBody, addHangoutSuggestionService, EditHangoutSuggestionBody, editHangoutSuggestionService } from "../../services/suggestionsServices";
import { DateTimePickerData, displayDateTimePicker, isValidDateTimePickerEvent } from "../dateTimePicker";
import { globalHangoutState } from "../globalHangoutState";
import { getDateAndTimeString } from "../../global/dateTimeUtils";
import { hangoutSuggestionState, renderSuggestionsSection } from "./hangoutSuggestions";
import { Suggestion } from "../hangoutTypes";
import { ConfirmModal } from "../../global/ConfirmModal";
import { sortHangoutSuggestions } from "./suggestionFilters";
import { directlyNavigateHangoutSections } from "../hangoutNav";

interface SuggestionsFormState {
  suggestionIdToEdit: number | null,

  suggestionStartTimestamp: number | null,
  suggestionEndTimestamp: number | null,
};

export const suggestionsFormState: SuggestionsFormState = {
  suggestionIdToEdit: null,

  suggestionEndTimestamp: null,
  suggestionStartTimestamp: null,
};

const suggestionsForm: HTMLFormElement | null = document.querySelector('#suggestions-form');
const suggestionsFormContainer: HTMLDivElement | null = document.querySelector('#suggestions-form-container');
const suggestionsFormDateTimeContainer: HTMLDivElement | null = document.querySelector('#suggestions-form-date-time-container');

const suggestionTitleInput: HTMLInputElement | null = document.querySelector('#suggestion-title-input');
const suggestionDescriptionTextarea: HTMLTextAreaElement | null = document.querySelector('#suggestion-description-textarea');

const suggestionStartMockInput: HTMLParagraphElement | null = document.querySelector('#suggestion-start-mock-input');
const suggestionEndMockInput: HTMLParagraphElement | null = document.querySelector('#suggestion-end-mock-input');

export function initHangoutSuggestionsForm(): void {
  loadEventListeners();
  setActiveValidation();
};

function loadEventListeners(): void {
  suggestionsForm?.addEventListener('submit', handleSuggestionsFormSubmission);
  suggestionsForm?.addEventListener('click', handleSuggestionsFormClicks);

  suggestionsFormDateTimeContainer?.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLParagraphElement)) {
      return;
    };

    if (!e.target.classList.contains('mock-input')) {
      return;
    };

    displayDateTimePicker('suggestionSlot');
  });

  suggestionsFormDateTimeContainer?.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.key !== 'Enter') {
      return;
    };

    displayDateTimePicker('suggestionSlot');
  });

  document.addEventListener('dateTimePicker-selection', async (e: Event) => {
    if (!isValidDateTimePickerEvent(e) || e.detail.purpose !== 'suggestionSlot') {
      return;
    };

    const dateTimePickerData: DateTimePickerData = e.detail;
    handleSuggestionDateTimeSelection(dateTimePickerData);
  });
};

async function handleSuggestionsFormSubmission(e: SubmitEvent): Promise<void> {
  e.preventDefault();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    return;
  };

  if (globalHangoutState.data.hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    return;
  };

  if (globalHangoutState.data.hangoutDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
    popup('Hangout is not in suggestions stage yet.', 'error');
    return;
  };

  if (suggestionsFormState.suggestionIdToEdit) {
    const { hasFailed, isIdentical, isMajorChange } = detectSuggestionEdits();

    if (hasFailed) {
      popup('Failed to update suggestion.', 'error');
      endHangoutSuggestionsFormEdit();

      return;
    };

    if (isIdentical) {
      popup('No suggestion changes found.', 'error');
      return;
    };

    if (isMajorChange) {
      handleMajorSuggestionChanges(suggestionsFormState.suggestionIdToEdit);
      return;
    };

    await editHangoutSuggestion(suggestionsFormState.suggestionIdToEdit);
    return;
  };

  await addHangoutSuggestion();
};

async function addHangoutSuggestion(): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, hangoutDetails } = globalHangoutState.data;

  if (hangoutDetails.current_stage !== HANGOUT_SUGGESTIONS_STAGE) {
    popup('Hangout is not in suggestions stage.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!suggestionStartMockInput || !suggestionEndMockInput || !suggestionTitleInput || !suggestionDescriptionTextarea) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidSuggestionTitle: boolean = validateSuggestionTitle(suggestionTitleInput);
  const isValidSuggestionDescription: boolean = validateSuggestionDescription(suggestionDescriptionTextarea);

  const { suggestionStartTimestamp, suggestionEndTimestamp } = suggestionsFormState;

  if (!suggestionStartTimestamp || !suggestionEndTimestamp) {
    ErrorSpan.display(suggestionStartMockInput, 'Suggestion date and time required.');
    ErrorSpan.display(suggestionEndMockInput, 'Suggestion date and time required.');

    popup('Invalid suggestion details.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!isValidSuggestionTitle || !isValidSuggestionDescription) {
    popup('Invalid suggestion details.', 'error');
    LoadingModal.remove();

    return;
  };

  const addHangoutSuggestionBody: AddHangoutSuggestionBody = {
    hangoutId,
    hangoutMemberId,
    suggestionTitle: suggestionTitleInput.value,
    suggestionDescription: suggestionDescriptionTextarea.value,
    suggestionStartTimestamp,
    suggestionEndTimestamp,
  };

  try {
    const suggestionId: number = (await addHangoutSuggestionService(addHangoutSuggestionBody)).data.suggestionId;

    hangoutSuggestionState.suggestions.push({
      suggestion_id: suggestionId,
      hangout_member_id: hangoutMemberId,
      suggestion_title: addHangoutSuggestionBody.suggestionTitle,
      suggestion_description: addHangoutSuggestionBody.suggestionDescription,
      suggestion_start_timestamp: suggestionStartTimestamp,
      suggestion_end_timestamp: suggestionEndTimestamp,
      is_edited: false,
      likes_count: 0,
      votes_count: 0,
    });

    clearSuggestionsForm();
    collapseSuggestionsForm();

    sortHangoutSuggestions();
    globalHangoutState.data.suggestionsCount++;

    renderSuggestionsSection();

    popup('Suggestion added.', 'success');
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

    if (status === 400 && !errReason) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 409) {
      globalHangoutState.data.suggestionsCount = HANGOUT_SUGGESTIONS_LIMIT;
      return;
    };

    if (status === 403) {
      if (errReason === 'hangoutConcluded') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
        globalHangoutState.data.hangoutDetails.is_concluded = true;

        return;
      };

      if (errReason === 'inAvailabilityStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_AVAILABILITY_STAGE;
        return;
      };

      if (errReason === 'inVotingStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_VOTING_STAGE;
      };

      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
      return;
    };

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (status === 400) {
      const inputRecord: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLParagraphElement | undefined> = {
        title: suggestionTitleInput,
        description: suggestionDescriptionTextarea,
        dateTime: suggestionStartMockInput,
      };

      const input = inputRecord[`${errReason}`];
      if (input) {
        ErrorSpan.display(input, errMessage);
      };
    };
  };
};

export function prepareHangoutSuggestionEditForm(suggestion: Suggestion): void {
  suggestionsFormState.suggestionIdToEdit = suggestion.suggestion_id;
  suggestionsFormState.suggestionStartTimestamp = suggestion.suggestion_start_timestamp;
  suggestionsFormState.suggestionEndTimestamp = suggestion.suggestion_end_timestamp;

  populateSuggestionsForm(suggestion);
  toggleSuggestionsFormUiState();

  expandSuggestionsFrom();
  suggestionTitleInput?.focus();
};

async function editHangoutSuggestion(suggestionId: number): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data || !suggestionsFormState.suggestionIdToEdit) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, hangoutDetails } = globalHangoutState.data;

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
    popup('Hangout is not in the suggestions stage yet.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!suggestionStartMockInput || !suggestionEndMockInput || !suggestionTitleInput || !suggestionDescriptionTextarea) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidSuggestionTitle: boolean = validateSuggestionTitle(suggestionTitleInput);
  const isValidSuggestionDescription: boolean = validateSuggestionDescription(suggestionDescriptionTextarea);

  const { suggestionStartTimestamp, suggestionEndTimestamp } = suggestionsFormState;

  if (!suggestionStartTimestamp || !suggestionEndTimestamp) {
    ErrorSpan.display(suggestionStartMockInput, 'Suggestion date and time required.');
    ErrorSpan.display(suggestionEndMockInput, 'Suggestion date and time required.');

    popup('Invalid suggestion details.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!isValidSuggestionTitle || !isValidSuggestionDescription) {
    popup('Invalid suggestion details.', 'error');
    LoadingModal.remove();

    return;
  };

  const newSuggestionTitle: string = suggestionTitleInput.value;
  const newSuggestionDescription: string = suggestionDescriptionTextarea.value;

  const editHangoutSuggestionBody: EditHangoutSuggestionBody = {
    hangoutId,
    hangoutMemberId,
    suggestionId,
    suggestionTitle: newSuggestionTitle,
    suggestionDescription: newSuggestionDescription,
    suggestionStartTimestamp,
    suggestionEndTimestamp
  };

  try {
    const isMajorChange: boolean = (await editHangoutSuggestionService(editHangoutSuggestionBody)).data.isMajorChange;

    hangoutSuggestionState.suggestions = hangoutSuggestionState.suggestions.map((suggestion: Suggestion) => {
      if (suggestion.suggestion_id !== suggestionId) {
        return suggestion;
      };

      return {
        ...suggestion,
        suggestion_title: newSuggestionTitle,
        suggestion_description: newSuggestionDescription,
        suggestion_start_timestamp: suggestionStartTimestamp,
        suggestion_end_timestamp: suggestionEndTimestamp,
        is_edited: true,
        likes_count: isMajorChange ? 0 : suggestion.likes_count,
        votes_count: isMajorChange ? 0 : suggestion.votes_count,
      };
    });

    endHangoutSuggestionsFormEdit();

    isMajorChange && sortHangoutSuggestions();
    renderSuggestionsSection();

    popup('Suggestion updated.', 'success');
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

    if (status === 400 && !errReason) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 404) {
      if (errReason === 'hangoutNotFound') {
        LoadingModal.display();
        setTimeout(() => window.location.reload(), 100);

        return;
      };

      globalHangoutState.data.suggestionsCount--;
      hangoutSuggestionState.suggestions = hangoutSuggestionState.suggestions.filter((suggestion: Suggestion) => suggestion.suggestion_id !== suggestionId);

      endHangoutSuggestionsFormEdit();
      renderSuggestionsSection();

      return;
    };

    if (status === 403) {
      endHangoutSuggestionsFormEdit();

      if (errReason === 'hangoutConcluded') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
        globalHangoutState.data.hangoutDetails.is_concluded = true;

        return;
      };

      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_AVAILABILITY_STAGE;
      return;
    };

    if (status === 401) {
      endHangoutSuggestionsFormEdit();

      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
      return;
    };

    if (status === 400) {
      const inputRecord: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLParagraphElement | undefined> = {
        title: suggestionTitleInput,
        description: suggestionDescriptionTextarea,
        dateTime: suggestionStartMockInput,
      };

      const input = inputRecord[`${errReason}`];
      if (input) {
        ErrorSpan.display(input, errMessage);
      };
    };
  };
};

function populateSuggestionsForm(suggestion: Suggestion): void {
  if (!suggestionTitleInput || !suggestionDescriptionTextarea) {
    return;
  };

  suggestionTitleInput.value = suggestion.suggestion_title;
  suggestionDescriptionTextarea.value = suggestion.suggestion_description;

  if (!suggestionStartMockInput || !suggestionEndMockInput) {
    return;
  };

  suggestionStartMockInput.textContent = getDateAndTimeString(suggestion.suggestion_start_timestamp);
  suggestionStartMockInput.classList.remove('empty');

  suggestionEndMockInput.textContent = getDateAndTimeString(suggestion.suggestion_end_timestamp);
  suggestionEndMockInput.classList.remove('empty');

  document.documentElement.scrollTo({ top: 0 });
};

function clearSuggestionsForm(): void {
  suggestionsFormState.suggestionIdToEdit = null;
  suggestionsFormState.suggestionStartTimestamp = null;
  suggestionsFormState.suggestionEndTimestamp = null;

  if (!suggestionTitleInput || !suggestionDescriptionTextarea) {
    return;
  };

  suggestionTitleInput.value = '';
  suggestionDescriptionTextarea.value = '';

  if (!suggestionStartMockInput || !suggestionEndMockInput) {
    return;
  };

  suggestionStartMockInput.textContent = 'Click to set date and time';
  suggestionStartMockInput.classList.add('empty');

  suggestionEndMockInput.textContent = 'Click to set date and time';
  suggestionEndMockInput.classList.add('empty');
};

function handleSuggestionDateTimeSelection(dateTimePickerData: DateTimePickerData): void {
  suggestionsFormState.suggestionStartTimestamp = dateTimePickerData.startTimestamp;
  suggestionsFormState.suggestionEndTimestamp = dateTimePickerData.endTimestamp;

  if (dateTimePickerData.existingSlotId) {
    suggestionsFormState.suggestionIdToEdit = dateTimePickerData.existingSlotId;
  };

  if (!suggestionStartMockInput || !suggestionEndMockInput) {
    return;
  };

  suggestionStartMockInput.textContent = getDateAndTimeString(dateTimePickerData.startTimestamp);
  suggestionEndMockInput.textContent = getDateAndTimeString(dateTimePickerData.endTimestamp);

  suggestionStartMockInput.classList.remove('empty');
  suggestionEndMockInput.classList.remove('empty');

  suggestionStartMockInput.parentElement?.classList.remove('error');
  suggestionEndMockInput.parentElement?.classList.remove('error');
};

function handleSuggestionsFormClicks(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'suggestions-form-header-btn') {
    if (!globalHangoutState.data) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { hangoutDetails, suggestionsCount } = globalHangoutState.data;

    if (hangoutDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
      popup('Not in suggestions stage yet.', 'error');
      return;
    };

    if (hangoutDetails.current_stage === HANGOUT_VOTING_STAGE) {
      return;
    };

    if (hangoutDetails.current_stage === HANGOUT_CONCLUSION_STAGE) {
      directlyNavigateHangoutSections('conclusion');
      return;
    };

    if (suggestionsCount === HANGOUT_SUGGESTIONS_LIMIT) {
      popup(`Suggestions limit of ${HANGOUT_SUGGESTIONS_LIMIT} reached.`, 'error');
      return;
    };

    expandSuggestionsFrom();
    return;
  };

  if (e.target.id === 'suggestions-form-collapse-btn') {
    collapseSuggestionsForm();
    endHangoutSuggestionsFormEdit();
  };
};

function setActiveValidation(): void {
  suggestionTitleInput?.addEventListener('input', () => validateSuggestionTitle(suggestionTitleInput));
  suggestionDescriptionTextarea?.addEventListener('input', () => {
    validateSuggestionDescription(suggestionDescriptionTextarea);
    autoExpandSuggestionTextarea(suggestionDescriptionTextarea);
    updateSuggestionCharacterCount(suggestionDescriptionTextarea);
  });
};

function autoExpandSuggestionTextarea(textarea: HTMLTextAreaElement): void {
  const minHeight: number = 62;
  const heightLimit: number = 400;

  textarea.style.height = '0px';
  const newHeight: number = Math.min(heightLimit, textarea.scrollHeight);

  if (newHeight < minHeight) {
    textarea.style.height = `${minHeight}px`;
    return;
  };

  textarea.style.height = `${newHeight}px`;
};

function updateSuggestionCharacterCount(textarea: HTMLTextAreaElement): void {
  const characterCountSpan: HTMLSpanElement | null = document.querySelector('#suggestion-description-character-count');

  if (!characterCountSpan) {
    return;
  };

  const characterCount: number = textarea.value.length;
  characterCountSpan.textContent = `${characterCount}`;

  if (characterCount > 500 || characterCount < 10) {
    characterCountSpan.parentElement?.classList.add('error');
    return;
  };

  characterCountSpan.parentElement?.classList.remove('error');
};

function expandSuggestionsFrom(): void {
  suggestionsFormContainer && (suggestionsFormContainer.style.display = 'block');
  suggestionsForm?.classList.add('expanded');
};

function collapseSuggestionsForm(): void {
  suggestionsForm?.classList.remove('expanded');
  suggestionsFormContainer && setTimeout(() => suggestionsFormContainer.style.display = 'none', 150);
};

export function endHangoutSuggestionsFormEdit(): void {
  if (!suggestionsFormState.suggestionIdToEdit) {
    return;
  };

  collapseSuggestionsForm();
  clearSuggestionsForm();
  toggleSuggestionsFormUiState();
};

function toggleSuggestionsFormUiState(): void {
  const suggestionsFormHeader: HTMLDivElement | null = document.querySelector('#suggestions-form-header');

  const formSubmitBtn: HTMLButtonElement | null = document.querySelector('#suggestions-form-submit-btn');
  const formCollapseBtn: HTMLButtonElement | null = document.querySelector('#suggestions-form-collapse-btn');

  if (!suggestionsFormHeader || !formSubmitBtn || !formCollapseBtn) {
    return;
  };

  if (suggestionsFormState.suggestionIdToEdit) {
    suggestionsFormHeader.style.display = 'none';

    formSubmitBtn.textContent = 'Update suggestion';
    formCollapseBtn.textContent = 'Cancel';

    return;
  };

  suggestionsFormHeader.style.display = 'block';

  formSubmitBtn.textContent = 'Add suggestion';
  formCollapseBtn.textContent = 'Collapse';
};

function detectSuggestionEdits(): { hasFailed: boolean, isIdentical: boolean, isMajorChange: boolean } {
  if (!suggestionsFormState.suggestionIdToEdit) {
    return { hasFailed: true, isIdentical: false, isMajorChange: false };
  };

  const originalSuggestion: Suggestion | undefined = hangoutSuggestionState.suggestions.find((suggestion: Suggestion) => suggestion.suggestion_id === suggestionsFormState.suggestionIdToEdit);

  if (!originalSuggestion) {
    globalHangoutState.data && globalHangoutState.data.suggestionsCount--;
    renderSuggestionsSection();

    return { hasFailed: true, isIdentical: false, isMajorChange: false };
  };

  if (!suggestionTitleInput || !suggestionDescriptionTextarea) {
    return { hasFailed: true, isIdentical: false, isMajorChange: false };
  };

  let isIdentical: boolean = true;
  let isMajorChange: boolean = false;

  const newTitle: string = suggestionTitleInput.value;
  const newDescription: string = suggestionDescriptionTextarea.value;

  if (originalSuggestion.suggestion_start_timestamp !== suggestionsFormState.suggestionStartTimestamp) {
    isIdentical = false;
    isMajorChange = true;
  };

  if (originalSuggestion.suggestion_end_timestamp !== suggestionsFormState.suggestionEndTimestamp) {
    isIdentical = false;
    isMajorChange = true;
  };

  if (originalSuggestion.suggestion_title !== newTitle) {
    isIdentical = false;
    isMajorChange = true;
  };

  if (originalSuggestion.suggestion_description !== newDescription) {
    isIdentical = false;
  };

  return { hasFailed: false, isIdentical, isMajorChange };
};

function handleMajorSuggestionChanges(suggestionId: number): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Major suggestion changes detected.',
    description: `Changing the suggestion's title or time slots will remove any likes or votes it gained.\n Are you sure you want to continue?`,
    confirmBtnTitle: 'Update suggestion',
    cancelBtnTitle: 'Cancel',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      ConfirmModal.remove();
      await editHangoutSuggestion(suggestionId);
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};