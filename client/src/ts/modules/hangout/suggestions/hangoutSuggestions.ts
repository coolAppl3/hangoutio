import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_SUGGESTIONS_LIMIT, HANGOUT_VOTING_STAGE } from "../../global/clientConstants";
import { createDivElement, createParagraphElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { getHangoutSuggestionsService } from "../../services/suggestionsServices";
import { hangoutAvailabilityState, initHangoutAvailability } from "../availability/hangoutAvailability";
import { globalHangoutState } from "../globalHangoutState";
import { Suggestion } from "../hangoutTypes";
import { initHangoutSuggestionsForm } from "./hangoutSuggestionsForm";
import { createSuggestionElement } from "./suggestionsUtils";

interface HangoutSuggestionsState {
  isLoaded: boolean,

  suggestions: Suggestion[],
  memberLikesSet: Set<number>,
  memberVotesSet: Set<number>,

  pageCount: number,
  pageItemsCount: number,
};

export const hangoutSuggestionState: HangoutSuggestionsState = {
  isLoaded: false,

  suggestions: [],
  memberLikesSet: new Set<number>(),
  memberVotesSet: new Set<number>(),

  pageCount: 1,
  pageItemsCount: 0,
};

const suggestionsRemainingSpan: HTMLSpanElement | null = document.querySelector('#suggestions-remaining-span');
const suggestionsContainer: HTMLDivElement | null = document.querySelector('#suggestions-container');

export function hangoutSuggestions(): void {
  loadEventListeners();
};

async function initHangoutSuggestions(): Promise<void> {
  if (hangoutSuggestionState.isLoaded) {
    renderSuggestionsSection();
    return;
  };

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    return;
  };

  LoadingModal.display();

  await getHangoutSuggestions();
  initHangoutSuggestionsForm();
  renderSuggestionsSection();

  LoadingModal.remove();
};

export function renderSuggestionsSection(): void {
  displayHangoutSuggestions();
  updateRemainingSuggestionsCount();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-suggestions', async () => {
    if (!hangoutAvailabilityState.isLoaded) {
      await initHangoutAvailability();
    };

    initHangoutSuggestions();
  });
};

async function getHangoutSuggestions(): Promise<void> {
  if (hangoutSuggestionState.isLoaded) {
    return;
  };

  if (!globalHangoutState.data) {
    popup('Failed to load hangout suggestions.', 'error');
    return;
  };

  const { hangoutId, hangoutMemberId } = globalHangoutState.data;

  try {
    const { suggestions, memberLikes, memberVotes } = (await getHangoutSuggestionsService({ hangoutId, hangoutMemberId })).data;

    hangoutSuggestionState.suggestions = suggestions;
    hangoutSuggestionState.memberLikesSet = new Set<number>(memberLikes);
    hangoutSuggestionState.memberVotesSet = new Set<number>(memberVotes);

    hangoutSuggestionState.isLoaded = true;

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Failed to load hangout suggestions.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Failed to load hangout suggestions.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 400) {
      popup('Failed to load hangout suggestions.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      if (errReason === 'notHangoutMember') {
        setTimeout(() => {
          sessionStorage.removeItem('latestHangoutSection');
          window.location.href = 'home';
        }, 1000);
      };

      return;
    };
  };
};

function displayHangoutSuggestions(): void {
  if (!suggestionsContainer || !globalHangoutState.data) {
    return;
  };

  if (hangoutSuggestionState.suggestions.length === 0) {
    suggestionsContainer.firstElementChild?.remove();
    suggestionsContainer.appendChild(createParagraphElement('no-suggestions', 'No suggestions yet'));

    return;
  };

  const { isLeader, hangoutDetails } = globalHangoutState.data;
  const pageCount: number = hangoutSuggestionState.pageCount;
  const suggestions: Suggestion[] = hangoutSuggestionState.suggestions;

  const innerSuggestionsContainer: HTMLDivElement = createDivElement('suggestions-container-inner');

  for (let i = (pageCount * 10) - 10; i < (pageCount * 10); i++) {
    if (i >= suggestions.length) {
      break;
    };

    innerSuggestionsContainer.appendChild(createSuggestionElement(suggestions[i], isLeader));
    hangoutSuggestionState.pageItemsCount = (i + 1) % 10 && (i + 1);
  };

  suggestionsContainer.firstElementChild?.remove();
  suggestionsContainer.appendChild(innerSuggestionsContainer);

  if (hangoutDetails.current_stage === HANGOUT_VOTING_STAGE) {
    suggestionsContainer.classList.add('in-voting-stage');
  };
};

function updateRemainingSuggestionsCount(): void {
  if (!suggestionsRemainingSpan || !globalHangoutState.data) {
    return;
  };

  const suggestionsCount: number = HANGOUT_SUGGESTIONS_LIMIT - globalHangoutState.data.suggestionsCount;
  suggestionsRemainingSpan.textContent = `${suggestionsCount}`;
};