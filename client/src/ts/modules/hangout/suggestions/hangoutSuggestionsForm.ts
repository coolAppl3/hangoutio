import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_SUGGESTIONS_LIMIT, HANGOUT_SUGGESTIONS_STAGE } from "../../global/clientConstants";
import ErrorSpan from "../../global/ErrorSpan";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { validateSuggestionDescription, validateSuggestionTitle } from "../../global/validation";
import { AddHangoutSuggestionBody, addHangoutSuggestionService } from "../../services/suggestionsServices";
import { DateTimePickerData, displayDateTimePicker, isValidDateTimePickerEvent } from "../dateTimePicker";
import { globalHangoutState } from "../globalHangoutState";

interface HangoutSuggestionFormState {
  suggestionIdToEdit: number | null,

  suggestionStartTimestamp: number | null,
  suggestionEndTimestamp: number | null,
};

const hangoutSuggestionFormState: HangoutSuggestionFormState = {
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

const suggestionsRemainingSpan: HTMLSpanElement | null = document.querySelector('#suggestions-remaining-span');

export function initHangoutSuggestionsForm(): void {
  renderSuggestionsForm();
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

    hangoutSuggestionFormState.suggestionStartTimestamp = dateTimePickerData.startTimestamp;
    hangoutSuggestionFormState.suggestionEndTimestamp = dateTimePickerData.endTimestamp;

    if (dateTimePickerData.existingSlotId) {
      hangoutSuggestionFormState.suggestionIdToEdit = dateTimePickerData.existingSlotId;
    };
  });
};

function renderSuggestionsForm(): void {
  updateRemainingSuggestionsCount();
};

async function handleSuggestionsFormSubmission(e: SubmitEvent): Promise<void> {
  e.preventDefault();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    return;
  };

  if (globalHangoutState.data.hangoutDetails.current_stage !== HANGOUT_SUGGESTIONS_STAGE) {
    popup('Not in suggestions stage.', 'error');
    return;
  };

  if (hangoutSuggestionFormState.suggestionIdToEdit) {
    await editHangoutSuggestion(hangoutSuggestionFormState.suggestionIdToEdit);
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
    popup('Not in suggestion stage.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!suggestionStartMockInput || !suggestionEndMockInput || !suggestionTitleInput || !suggestionDescriptionTextarea) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { suggestionStartTimestamp, suggestionEndTimestamp } = hangoutSuggestionFormState;

  if (!suggestionStartTimestamp || !suggestionEndTimestamp) {
    ErrorSpan.display(suggestionStartMockInput, 'Suggestion date and time required.');
    ErrorSpan.display(suggestionEndMockInput, 'Suggestion date and time required.');

    popup('Suggestion date and time required.', 'error');
    LoadingModal.remove();

    return;
  };

  ErrorSpan.hide(suggestionStartMockInput);
  ErrorSpan.hide(suggestionEndMockInput);

  const isValidSuggestionTitle: boolean = validateSuggestionTitle(suggestionTitleInput);
  const isValidSuggestionDescription: boolean = validateSuggestionDescription(suggestionDescriptionTextarea);

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
    suggestionEndTimestamp,
    suggestionStartTimestamp,
  };

  try {
    const suggestionId: number = (await addHangoutSuggestionService(addHangoutSuggestionBody)).data.suggestionId;

    popup('Suggestion added.', 'success');
    LoadingModal.remove();

    // TODO: add to state, resort, rerender.

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 400 && (errReason === 'hangoutId' || errReason === 'hangoutMemberId')) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 400) {
      setTimeout(() => window.location.reload(), 1000);
      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired(window.location.href);
        return;
      };

      if (errReason === 'authSessionDestroyed') {
        handleAuthSessionDestroyed(window.location.href);
      };

      return;
    };

    const inputRecord: Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLParagraphElement | undefined> = {
      title: suggestionTitleInput,
      description: suggestionDescriptionTextarea,
      dateTime: suggestionStartMockInput,
    };

    if (status === 400) {
      const input = inputRecord[`${errReason}`];
      if (input) {
        ErrorSpan.display(input, errMessage);
      };
    };
  };
};

async function editHangoutSuggestion(suggestionId: number): Promise<void> {
  // TODO: continue implementation
};

function updateRemainingSuggestionsCount(): void {
  if (!suggestionsRemainingSpan || !globalHangoutState.data) {
    return;
  };

  const suggestionsCount: number = HANGOUT_SUGGESTIONS_LIMIT - globalHangoutState.data.suggestionsCount;
  suggestionsRemainingSpan.textContent = `${suggestionsCount}`;
};

function handleSuggestionsFormClicks(e: MouseEvent): void {
  if (!(e.target instanceof HTMLElement)) {
    return;
  };

  if (e.target.id === 'suggestions-form-expand-btn') {
    if (!globalHangoutState.data) {
      popup('Something went wrong.', 'error');
      return;
    };

    if (globalHangoutState.data.hangoutDetails.current_stage !== HANGOUT_SUGGESTIONS_STAGE) {
      popup('Not in suggestions stage.', 'error');
      return;
    };

    suggestionsFormContainer && (suggestionsFormContainer.style.display = 'block');
    suggestionsForm?.classList.add('expanded');

    return;
  };

  if (e.target.id === 'suggestions-form-collapse-btn') {
    suggestionsForm?.classList.remove('expanded');
    suggestionsFormContainer && setTimeout(() => suggestionsFormContainer.style.display = 'none', 150);

    return;
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

  if (characterCount > 500) {
    characterCountSpan.parentElement?.classList.add('error');
    return;
  };

  characterCountSpan.parentElement?.classList.remove('error');
};