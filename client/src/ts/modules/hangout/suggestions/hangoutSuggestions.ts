import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_LIMIT, HANGOUT_VOTING_STAGE } from "../../global/clientConstants";
import { ConfirmModal } from "../../global/ConfirmModal";
import { createDivElement, createParagraphElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { addHangoutSuggestionLikeService, deleteHangoutSuggestionAsLeaderService, deleteHangoutSuggestionService, getHangoutSuggestionsService, removeHangoutSuggestionLikeService } from "../../services/suggestionsServices";
import { hangoutAvailabilityState, initHangoutAvailability } from "../availability/hangoutAvailability";
import { globalHangoutState } from "../globalHangoutState";
import { Suggestion } from "../hangoutTypes";
import { filterSuggestions, initHangoutSuggestionsFilter, sortHangoutSuggestions } from "./suggestionFilters";
import { endHangoutSuggestionsFormEdit, suggestionsFormState, initHangoutSuggestionsForm, prepareHangoutSuggestionEditForm } from "./suggestionsForm";
import { createSuggestionElement, displaySuggestionLikeIcon, removeSuggestionLikeIcon, updateSuggestionDropdownMenuBtnAttributes, updateSuggestionLikeBtnAttributes } from "./suggestionsUtils";

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
  initHangoutSuggestionsFilter();

  sortHangoutSuggestions();
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
        LoadingModal.display()
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

  const innerSuggestionsContainer: HTMLDivElement = createDivElement('suggestions-container-inner');

  const { isLeader, hangoutDetails } = globalHangoutState.data;
  const { suggestions, pageCount } = hangoutSuggestionState;

  const filteredSuggestions: Suggestion[] = filterSuggestions(suggestions);

  if (filteredSuggestions.length === 0) {
    suggestionsContainer.firstElementChild?.remove();
    suggestionsContainer.appendChild(createParagraphElement('no-suggestions', 'No suggestions match these filters'));

    return;
  };

  for (let i = (pageCount * 10) - 10; i < (pageCount * 10); i++) {
    if (i >= filteredSuggestions.length) {
      break;
    };

    innerSuggestionsContainer.appendChild(createSuggestionElement(filteredSuggestions[i], isLeader));
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
    renderSuggestionsSection();

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
    updateSuggestionDropdownMenuBtnAttributes(suggestionElement);

    return;
  };

  if (e.target.classList.contains('edit-btn')) {
    const hangoutMemberId: number = globalHangoutState.data.hangoutMemberId;
    if (suggestion.hangout_member_id !== hangoutMemberId) {
      popup(`You can only edit your own suggestions.`, 'error');
      return;
    };

    e.target.closest('.dropdown-menu')?.classList.remove('expanded');
    prepareHangoutSuggestionEditForm(suggestion);

    return;
  };

  if (e.target.classList.contains('delete-btn')) {
    e.target.closest('.dropdown-menu')?.classList.remove('expanded');

    const { hangoutMemberId, isLeader } = globalHangoutState.data;
    const isMemberOwnSuggestion: boolean = suggestion.hangout_member_id === hangoutMemberId;

    if (!isMemberOwnSuggestion && !isLeader) {
      popup(`You're not the hangout leader.`, 'error');
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

        if (suggestionsFormState.suggestionIdToEdit === suggestion.suggestion_id) {
          endHangoutSuggestionsFormEdit();
        };

        if (!isMemberOwnSuggestion) {
          await deleteHangoutSuggestionAsLeader(suggestion, suggestionElement);
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
        ConfirmModal.remove();
        prepareHangoutSuggestionEditForm(suggestion);
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

    displaySuggestionLikeIcon(suggestionElement);
    updateSuggestionLikeBtnAttributes(suggestionElement);

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

      renderSuggestionsSection();
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

    removeSuggestionLikeIcon(suggestionElement);
    updateSuggestionLikeBtnAttributes(suggestionElement);

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

async function deleteHangoutSuggestion(suggestion: Suggestion, suggestionElement: HTMLDivElement): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutMemberId, hangoutId, hangoutDetails } = globalHangoutState.data;
  const suggestionDropdownMenu: HTMLDivElement | null = suggestionElement.querySelector('.dropdown-menu');

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
    popup('Hangout has not reached the suggestions stage yet.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await deleteHangoutSuggestionService({ suggestionId: suggestion.suggestion_id, hangoutMemberId, hangoutId });

    hangoutSuggestionState.suggestions = hangoutSuggestionState.suggestions.filter((existingSuggestion: Suggestion) => existingSuggestion.suggestion_id !== suggestion.suggestion_id);

    hangoutSuggestionState.memberLikesSet.delete(suggestion.suggestion_id);
    hangoutSuggestionState.memberVotesSet.delete(suggestion.suggestion_id);

    globalHangoutState.data.suggestionsCount--;
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
      suggestionDropdownMenu?.classList.remove('expanded');

      return;
    };

    popup(errMessage, 'error');
    suggestionDropdownMenu?.classList.remove('expanded');

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (status === 403) {
      if (errReason === 'inAvailabilityStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_AVAILABILITY_STAGE;
        renderSuggestionsSection();

        return;
      };

      if (errReason === 'hangoutConcluded') {
        globalHangoutState.data.hangoutDetails.current_stage === HANGOUT_CONCLUSION_STAGE;
        renderSuggestionsSection();
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

async function deleteHangoutSuggestionAsLeader(suggestion: Suggestion, suggestionElement: HTMLDivElement): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutMemberId, hangoutId, hangoutDetails, suggestionsCount, isLeader } = globalHangoutState.data;
  const suggestionDropdownMenu: HTMLDivElement | null = suggestionElement.querySelector('.dropdown-menu');

  if (suggestion.hangout_member_id === hangoutMemberId) {
    await deleteHangoutSuggestion(suggestion, suggestionElement);
    return;
  };

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
    popup('Hangout has not reached the suggestions stage yet.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await deleteHangoutSuggestionAsLeaderService({ suggestionId: suggestion.suggestion_id, hangoutMemberId, hangoutId });

    hangoutSuggestionState.suggestions = hangoutSuggestionState.suggestions.filter((existingSuggestion: Suggestion) => existingSuggestion.suggestion_id !== suggestion.suggestion_id);

    hangoutSuggestionState.memberLikesSet.delete(suggestion.suggestion_id);
    hangoutSuggestionState.memberVotesSet.delete(suggestion.suggestion_id);

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
      suggestionDropdownMenu?.classList.remove('expanded');

      return;
    };

    popup(errMessage, 'error');
    suggestionDropdownMenu?.classList.remove('expanded');

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (status === 403) {
      if (errReason === 'inAvailabilityStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_AVAILABILITY_STAGE;
        renderSuggestionsSection();

        return;
      };

      if (errReason === 'hangoutConcluded') {
        globalHangoutState.data.hangoutDetails.current_stage === HANGOUT_CONCLUSION_STAGE;
        renderSuggestionsSection();
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