import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_LIMIT, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE } from "../../global/clientConstants";
import { ConfirmModal } from "../../global/ConfirmModal";
import { createDivElement, createParagraphElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { addHangoutSuggestionLikeService, deleteHangoutSuggestionService, getHangoutSuggestionsService, removeHangoutSuggestionLikeService } from "../../services/suggestionsServices";
import { hangoutAvailabilityState, initHangoutAvailability } from "../availability/hangoutAvailability";
import { renderDashboardSection } from "../dashboard/hangoutDashboard";
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

  sortingMode: 'likes' | 'votes',
};

export const hangoutSuggestionState: HangoutSuggestionsState = {
  isLoaded: false,

  suggestions: [],
  memberLikesSet: new Set<number>(),
  memberVotesSet: new Set<number>(),

  pageCount: 1,
  pageItemsCount: 0,

  sortingMode: 'likes',
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

export function sortHangoutSuggestions(): void {
  const sortMode: 'likes' | 'votes' = hangoutSuggestionState.sortingMode
  hangoutSuggestionState.suggestions.sort((a, b) => a[`${sortMode}_count`] - b[`${sortMode}_count`]);
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-suggestions', async () => {
    if (!hangoutAvailabilityState.isLoaded) {
      await initHangoutAvailability();
    };

    initHangoutSuggestions();
  });

  suggestionsContainer?.addEventListener('click', handleSuggestionsContainerClicks);
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
        setTimeout(() => LoadingModal.display(), 0);
        setTimeout(() => window.location.reload(), 1000);
      };
    };
  };
};

function displayHangoutSuggestions(): void {
  if (!suggestionsContainer || !globalHangoutState.data) {
    return;
  };

  if (hangoutSuggestionState.suggestions.length === 0) {
    suggestionsContainer.firstElementChild?.remove();
    suggestionsContainer.appendChild(createParagraphElement('no-suggestions', 'No suggestions found'));

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

async function handleSuggestionsContainerClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    return;
  };

  const suggestionElement: Element | null = e.target.closest('.suggestion');

  if (!suggestionElement || !(suggestionElement instanceof HTMLDivElement)) {
    return;
  };

  const suggestionIdString: string | null = suggestionElement.getAttribute('data-suggestionId');

  if (!suggestionIdString || !Number.isInteger(+suggestionIdString)) {
    return;
  };

  const suggestion: Suggestion | undefined = hangoutSuggestionState.suggestions.find((suggestion: Suggestion) => suggestion.suggestion_id === +suggestionIdString);

  if (!suggestion) {
    popup('Suggestion not found.', 'error');
    LoadingModal.display();

    renderSuggestionsSection();
    LoadingModal.remove();

    return;
  };

  if (e.target.classList.contains('view-suggestion-btn')) {
    suggestionElement.classList.toggle('expanded');
    return;
  };

  if (e.target.classList.contains('like-suggestion-btn')) {
    if (suggestionElement.classList.contains('like-pending')) {
      return;
    };

    if (suggestionElement.classList.contains('liked')) {
      removeHangoutSuggestionLike(suggestion, suggestionElement);
      return;
    };

    await addHangoutSuggestionLike(suggestion, suggestionElement);
    return;
  };

  if (e.target.classList.contains('dropdown-menu-btn')) {
    e.target.parentElement?.classList.toggle('expanded');
    return;
  };

  if (e.target.classList.contains('delete-btn')) {
    const { hangoutMemberId, isLeader } = globalHangoutState.data;
    const isMemberOwnSuggestion: boolean = suggestion.hangout_member_id === hangoutMemberId;

    if (!isMemberOwnSuggestion && !isLeader) {
      popup(`Can't delete other members' suggestions.`, 'error');
      return;
    };

    const confirmModal: HTMLDivElement = ConfirmModal.display({
      title: 'Are you sure you want to delete this suggestion?',
      description: 'Any likes or votes associated with it will be permanently lost.',
      confirmBtnTitle: 'Delete suggestion',
      cancelBtnTitle: 'Cancel',
      extraBtnTitle: isMemberOwnSuggestion ? 'Edit suggestion' : null,
      isDangerousAction: true,
    });

    confirmModal.addEventListener('click', async (e: MouseEvent) => {
      if (!(e.target instanceof HTMLButtonElement)) {
        return;
      };

      if (e.target.id === 'confirm-modal-confirm-btn') {
        ConfirmModal.remove();

        if (!isMemberOwnSuggestion) {
          await deleteHangoutSuggestionAsLeader();
          return;
        };

        await deleteHangoutSuggestion(suggestion, suggestionElement);
        return;
      };

      if (e.target.id === 'confirm-modal-cancel-btn') {
        ConfirmModal.remove();
        return;
      };

      if (e.target.id === 'confirm-modal-other-btn') {
        // TODO: implement suggestion edit logic.
      };
    });

    return;
  };
};

async function addHangoutSuggestionLike(suggestion: Suggestion, suggestionElement: HTMLDivElement): Promise<void> {
  if (!globalHangoutState.data) {
    popup('Failed to like suggestion.', 'error');
    return;
  };

  if (hangoutSuggestionState.memberLikesSet.has(suggestion.suggestion_id)) {
    return;
  };

  suggestionElement.classList.add('like-pending');
  const { hangoutMemberId, hangoutId } = globalHangoutState.data;

  try {
    await addHangoutSuggestionLikeService({ suggestionId: suggestion.suggestion_id, hangoutMemberId, hangoutId });

    hangoutSuggestionState.memberLikesSet.add(suggestion.suggestion_id);
    suggestion.likes_count++

    sortHangoutSuggestions();
    displaySuggestionLikeIcon(suggestionElement);

  } catch (err: unknown) {
    console.log(err);
    suggestionElement.classList.remove('like-pending');

    if (!axios.isAxiosError(err)) {
      popup('Failed to like suggestion.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Failed to like suggestion.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 400) {
      popup('Failed to like suggestion.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 409) {
      hangoutSuggestionState.memberLikesSet.add(suggestion.suggestion_id);
      displaySuggestionLikeIcon(suggestionElement);

      return;
    };

    if (status === 404) {
      hangoutSuggestionState.suggestions = hangoutSuggestionState.suggestions.filter((existingSuggestion: Suggestion) => existingSuggestion.suggestion_id !== suggestion.suggestion_id);

      if (suggestion.hangout_member_id === globalHangoutState.data.hangoutMemberId) {
        globalHangoutState.data.suggestionsCount--;
      };

      LoadingModal.display();

      renderSuggestionsSection();
      renderDashboardSection();

      LoadingModal.remove();
      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      if (errReason === 'notHangoutMember') {
        popup(errMessage, 'error');
        LoadingModal.display();

        setTimeout(() => window.location.reload(), 1000);
      };
    };
  };
};

async function removeHangoutSuggestionLike(suggestion: Suggestion, suggestionElement: HTMLDivElement): Promise<void> {
  if (!globalHangoutState.data) {
    popup('Failed to like suggestion.', 'error');
    return;
  };

  if (!hangoutSuggestionState.memberLikesSet.has(suggestion.suggestion_id)) {
    return;
  };

  suggestionElement.classList.add('like-pending');
  const { hangoutMemberId, hangoutId } = globalHangoutState.data;

  try {
    await removeHangoutSuggestionLikeService({ suggestionId: suggestion.suggestion_id, hangoutMemberId, hangoutId });

    hangoutSuggestionState.memberLikesSet.delete(suggestion.suggestion_id);
    suggestion.likes_count--;

    sortHangoutSuggestions();
    removeSuggestionLikeIcon(suggestionElement);

  } catch (err: unknown) {
    console.log(err);
    suggestionElement.classList.remove('like-pending');

    if (!axios.isAxiosError(err)) {
      popup('Failed to unlike suggestion.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Failed to unlike suggestion.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 400) {
      popup('Failed to unlike suggestion.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      if (errReason === 'notHangoutMember') {
        popup(errMessage, 'error');
        LoadingModal.display();

        setTimeout(() => window.location.reload(), 1000);
      };
    };
  };
};

function displaySuggestionLikeIcon(suggestionElement: HTMLDivElement): void {
  const suggestionLikesCountSpan: HTMLSpanElement | null = suggestionElement.querySelector('.rating-container span');

  if (!suggestionLikesCountSpan) {
    return;
  };

  const suggestionLikesCountString: string | null = suggestionLikesCountSpan.textContent;

  if (!suggestionLikesCountString || !Number.isInteger(+suggestionLikesCountString)) {
    return;
  };

  const suggestionLikesCount: number = +suggestionLikesCountString;
  suggestionLikesCountSpan.textContent = `${suggestionLikesCount + 1}`;

  suggestionElement.classList.remove('like-pending');
  suggestionElement.classList.add('liked');
};

function removeSuggestionLikeIcon(suggestionElement: HTMLDivElement): void {
  const suggestionLikesCountSpan: HTMLSpanElement | null = suggestionElement.querySelector('.rating-container span');

  if (!suggestionLikesCountSpan) {
    return;
  };

  const suggestionLikesCountString: string | null = suggestionLikesCountSpan.textContent;

  if (!suggestionLikesCountString || !Number.isInteger(+suggestionLikesCountString)) {
    return;
  };

  const suggestionLikesCount: number = +suggestionLikesCountString;
  suggestionLikesCountSpan.textContent = `${(suggestionLikesCount - 1) < 0 ? 0 : suggestionLikesCount - 1}`;

  suggestionElement.classList.remove('like-pending', 'liked');
};

async function deleteHangoutSuggestion(suggestion: Suggestion, suggestionElement: HTMLDivElement): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutMemberId, hangoutId, hangoutDetails, suggestionsCount } = globalHangoutState.data;
  const suggestionDropdownMenu: HTMLDivElement | null = suggestionElement.querySelector('.dropdown-menu');

  if (hangoutDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
    return;
  };

  if (hangoutDetails.current_stage === HANGOUT_CONCLUSION_STAGE) {
    popup(`Can't alter suggestions after hangout conclusion.`, 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await deleteHangoutSuggestionService({ suggestionId: suggestion.suggestion_id, hangoutMemberId, hangoutId });

    hangoutSuggestionState.suggestions = hangoutSuggestionState.suggestions.filter((existingSuggestion: Suggestion) => existingSuggestion.suggestion_id !== suggestion.suggestion_id);

    hangoutSuggestionState.memberLikesSet.delete(suggestion.suggestion_id);
    hangoutSuggestionState.memberVotesSet.delete(suggestion.suggestion_id);

    globalHangoutState.data.suggestionsCount = suggestionsCount - 1 < 0 ? 0 : suggestionsCount - 1;

    suggestionDropdownMenu?.classList.remove('expanded');
    renderSuggestionsSection();

    popup('Suggestion deleted.', 'success');
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
    suggestionDropdownMenu?.classList.remove('expanded');

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (status === 409) {
      if (errReason === 'inAvailabilityStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_AVAILABILITY_STAGE;
        renderDashboardSection();

        return;
      };

      if (errReason === 'hangoutConcluded') {
        globalHangoutState.data.hangoutDetails.current_stage === HANGOUT_CONCLUSION_STAGE;
        renderDashboardSection();
      };

      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      if (errReason === 'authSessionDestroyed') {
        handleAuthSessionDestroyed();
      };
    };
  };
};

async function deleteHangoutSuggestionAsLeader(): Promise<void> {
  // TODO: implement
};