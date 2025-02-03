import { HANGOUT_SUGGESTIONS_LIMIT } from "../../global/clientConstants";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { validateSuggestionDescription, validateSuggestionTitle } from "../../global/validation";
import { DateTimePickerData, displayDateTimePicker, isValidDateTimePickerEvent } from "../dateTimePicker";
import { globalHangoutState } from "../globalHangoutState";

interface HangoutSuggestionFormState {
  inEditMode: boolean,

  suggestionStartTimestamp: number | null,
  suggestionEndTimestamp: number | null,
};

const hangoutSuggestionFormState: HangoutSuggestionFormState = {
  inEditMode: false,

  suggestionEndTimestamp: null,
  suggestionStartTimestamp: null,
};

const suggestionsForm: HTMLFormElement | null = document.querySelector('#suggestions-form');
const suggestionsFormContainer: HTMLDivElement | null = document.querySelector('#suggestions-form-container');
const suggestionsFormDateTimeContainer: HTMLDivElement | null = document.querySelector('#suggestions-form-date-time-container');

const suggestionTitleInput: HTMLInputElement | null = document.querySelector('#suggestion-title-input');
const suggestionDescriptionTextarea: HTMLTextAreaElement | null = document.querySelector('#suggestion-description-textarea');

const suggestionsRemainingSpan: HTMLSpanElement | null = document.querySelector('#suggestions-remaining-span');

export function initHangoutSuggestionsForm(): void {
  renderSuggestionsSection();
  loadEventListeners();
  setActiveValidation();
};

function loadEventListeners(): void {
  suggestionsForm?.addEventListener('submit', addHangoutSuggestion);
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
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const dateTimePickerData: DateTimePickerData = e.detail;

    hangoutSuggestionFormState.suggestionStartTimestamp = dateTimePickerData.startTimestamp;
    hangoutSuggestionFormState.suggestionEndTimestamp = dateTimePickerData.endTimestamp;

    if (dateTimePickerData.existingSlotId) {
      hangoutSuggestionFormState.inEditMode = true;
    };
  });
};

function renderSuggestionsSection(): void {
  updateRemainingSuggestionsCount();
};

async function addHangoutSuggestion(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

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