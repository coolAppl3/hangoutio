import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_LIMIT, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTES_LIMIT, HANGOUT_VOTING_STAGE, MAX_HANGOUT_MEMBERS_LIMIT } from "../../global/clientConstants";
import { ConfirmModal } from "../../global/ConfirmModal";
import { createDivElement, createParagraphElement } from "../../global/domUtils";
import { AsyncErrorData, getAsyncErrorData } from "../../global/errorUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { addHangoutSuggestionLikeService, deleteHangoutSuggestionAsLeaderService, deleteHangoutSuggestionService, getHangoutSuggestionsService, removeHangoutSuggestionLikeService } from "../../services/suggestionsServices";
import { addHangoutVoteService, removeHangoutVoteService } from "../../services/votesServices";
import { hangoutAvailabilityState, initHangoutAvailability } from "../availability/hangoutAvailability";
import { globalHangoutState } from "../globalHangoutState";
import { HangoutsDetails, Suggestion } from "../hangoutTypes";
import { filterSuggestions, initHangoutSuggestionsFilter, sortHangoutSuggestions, suggestionFiltersState } from "./suggestionFilters";
import { endHangoutSuggestionsFormEdit, suggestionsFormState, initHangoutSuggestionsForm, prepareHangoutSuggestionEditForm } from "./suggestionsForm";
import { createSuggestionElement, displaySuggestionLikeIcon, removeSuggestionLikeIcon, updateSuggestionDropdownMenuBtnAttributes, updateSuggestionLikeBtnAttributes, updateSuggestionsFormHeader, updateSuggestionVoteValues } from "./suggestionsUtils";

interface HangoutSuggestionsState {
  isLoaded: boolean,
  suggestionsSectionMutationObserverActive: boolean,

  suggestions: Suggestion[],
  memberLikesSet: Set<number>,
  memberVotesSet: Set<number>,

  maxSuggestionsToRender: number,
  suggestionsRenderLimit: number,
};

export const hangoutSuggestionState: HangoutSuggestionsState = {
  isLoaded: false,
  suggestionsSectionMutationObserverActive: false,

  suggestions: [],
  memberLikesSet: new Set<number>(),
  memberVotesSet: new Set<number>(),

  maxSuggestionsToRender: 10,
  suggestionsRenderLimit: MAX_HANGOUT_MEMBERS_LIMIT * HANGOUT_SUGGESTIONS_LIMIT,
};

const suggestionsContainer: HTMLDivElement | null = document.querySelector('#suggestions-container');

const suggestionsRemainingSpan: HTMLSpanElement | null = document.querySelector('#suggestions-remaining-span');
const votesRemainingSpan: HTMLSpanElement | null = document.querySelector('#votes-remaining-span');

const suggestionsSectionElement: HTMLDivElement | null = document.querySelector('#suggestions-section');
const renderMoreSuggestionsBtn: HTMLButtonElement | null = document.querySelector('#render-more-suggestions-btn');

export function hangoutSuggestions(): void {
  loadEventListeners();
};

export async function initHangoutSuggestions(): Promise<void> {
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
  renderHangoutSuggestions();
  updateRemainingSuggestionsCount();
  updateRemainingVotesCount();
  updateSuggestionsFormHeader();

  if (!hangoutSuggestionState.suggestionsSectionMutationObserverActive) {
    initSuggestionsSectionMutationObserver();
  };
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-suggestions', async () => {
    if (!hangoutAvailabilityState.isLoaded) {
      await initHangoutAvailability();
    };

    await initHangoutSuggestions();
  });

  suggestionsContainer?.addEventListener('click', handleSuggestionsContainerClicks);
  renderMoreSuggestionsBtn?.addEventListener('click', renderMoreSuggestions);
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

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400) {
      popup('Failed to load hangout suggestions.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 401) {
      if (errReason === 'notHangoutMember') {
        LoadingModal.display()
        setTimeout(() => window.location.reload(), 1000);

        return;
      };

      handleAuthSessionExpired();
    };
  };
};

export function renderHangoutSuggestions(): void {
  if (!suggestionsContainer || !globalHangoutState.data) {
    renderMoreSuggestionsBtn?.classList.add('hidden');
    return;
  };

  if (hangoutSuggestionState.suggestions.length === 0) {
    suggestionsContainer.firstElementChild?.remove();
    suggestionsContainer.appendChild(createParagraphElement('no-suggestions', 'No suggestions found'));

    renderMoreSuggestionsBtn?.classList.add('hidden');
    return;
  };

  const innerSuggestionsContainer: HTMLDivElement = createDivElement('suggestions-container-inner');

  const isLeader: boolean = globalHangoutState.data.isLeader;
  const { suggestions, maxSuggestionsToRender } = hangoutSuggestionState;

  const filteredSuggestions: Suggestion[] = filterSuggestions(suggestions);

  if (filteredSuggestions.length === 0) {
    suggestionsContainer.firstElementChild?.remove();
    suggestionsContainer.appendChild(createParagraphElement('no-suggestions', 'No suggestions match these filters'));

    renderMoreSuggestionsBtn?.classList.add('hidden');
    return;
  };

  for (let i = 0; i < maxSuggestionsToRender; i++) {
    const suggestion: Suggestion | undefined = filteredSuggestions[i];

    if (!suggestion) {
      continue;
    };

    innerSuggestionsContainer.appendChild(createSuggestionElement(suggestion, isLeader));
  };

  suggestionsContainer.firstElementChild?.remove();
  suggestionsContainer.appendChild(innerSuggestionsContainer);

  const displayRenderMoreSuggestionsBtn: boolean = maxSuggestionsToRender < filteredSuggestions.length;
  applySuggestionsContainerStyles(displayRenderMoreSuggestionsBtn);
};

function applySuggestionsContainerStyles(displayRenderMoreSuggestionsBtn: boolean): void {
  if (!globalHangoutState.data || !suggestionsContainer) {
    return;
  };

  const hangoutDetails: HangoutsDetails = globalHangoutState.data.hangoutDetails;

  if (hangoutDetails.current_stage === HANGOUT_VOTING_STAGE) {
    suggestionsContainer.classList.add('in-voting-stage');

  } else {
    suggestionsContainer.classList.remove('in-voting-stage');
  };

  if (globalHangoutState.data.votesCount >= HANGOUT_VOTES_LIMIT) {
    suggestionsContainer.classList.add('votes-limit-reached');

  } else {
    suggestionsContainer.classList.remove('votes-limit-reached');
  };

  if (displayRenderMoreSuggestionsBtn) {
    renderMoreSuggestionsBtn?.classList.remove('hidden');
    return;
  };

  renderMoreSuggestionsBtn?.classList.add('hidden');
};

export function updateRemainingSuggestionsCount(): void {
  if (!globalHangoutState.data || !suggestionsRemainingSpan) {
    return;
  };

  const suggestionsCount: number = HANGOUT_SUGGESTIONS_LIMIT - globalHangoutState.data.suggestionsCount;
  suggestionsRemainingSpan.textContent = `${suggestionsCount}`;
};

export function updateRemainingVotesCount(): void {
  if (!globalHangoutState.data || !votesRemainingSpan) {
    return;
  };

  const votesCount: number = HANGOUT_VOTES_LIMIT - globalHangoutState.data.votesCount;
  votesRemainingSpan.textContent = `${votesCount}`;
};

async function handleSuggestionsContainerClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (!globalHangoutState.data) {
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
    toggleSuggestionExpansion(suggestionElement);
    return;
  };

  if (e.target.classList.contains('toggle-vote-btn')) {
    await handleVoteBtnClicks(suggestion, suggestionElement);
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

  if (globalHangoutState.data.hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
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

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

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
      if (errReason === 'notHangoutMember') {
        LoadingModal.display();
        setTimeout(() => window.location.reload(), 1000);

        return;
      };

      handleAuthSessionExpired();
    };
  };
};

async function removeHangoutSuggestionLike(suggestion: Suggestion, suggestionElement: HTMLDivElement): Promise<void> {
  if (!globalHangoutState.data) {
    popup('Failed to like suggestion.', 'error');
    return;
  };

  if (globalHangoutState.data.hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
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

    if (suggestionFiltersState.filterByLiked) {
      renderSuggestionsSection();
      return;
    };

    removeSuggestionLikeIcon(suggestionElement);
    updateSuggestionLikeBtnAttributes(suggestionElement);

  } catch (err: unknown) {
    console.log(err);
    suggestionElement.classList.remove('like-pending');

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400) {
      popup('Failed to unlike suggestion.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 401) {
      if (errReason === 'notHangoutMember') {
        LoadingModal.display();
        setTimeout(() => window.location.reload(), 1000);

        return;
      };

      handleAuthSessionExpired();
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

  if (hangoutDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
    popup('Hangout has not reached the suggestions stage yet.', 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.current_stage === HANGOUT_VOTING_STAGE) {
    popup(`Suggestions can't be deleted after the suggestions stage ends.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
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

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

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

      if (errReason === 'inVotingStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_VOTING_STAGE;
        renderSuggestionsSection();

        return;
      };

      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
      globalHangoutState.data.hangoutDetails.is_concluded = true;

      renderSuggestionsSection();
      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
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

  const { hangoutMemberId, hangoutId, hangoutDetails, isLeader } = globalHangoutState.data;
  const suggestionDropdownMenu: HTMLDivElement | null = suggestionElement.querySelector('.dropdown-menu');

  if (suggestion.hangout_member_id === hangoutMemberId) {
    await deleteHangoutSuggestion(suggestion, suggestionElement);
    return;
  };

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.current_stage === HANGOUT_AVAILABILITY_STAGE) {
    popup('Hangout has not reached the suggestions stage yet.', 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.current_stage === HANGOUT_VOTING_STAGE) {
    popup(`Suggestions can't be deleted after the suggestions stage ends.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
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

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

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

      if (errReason === 'inVotingStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_VOTING_STAGE;
        renderSuggestionsSection();

        return;
      };

      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
      globalHangoutState.data.hangoutDetails.is_concluded = true;

      renderSuggestionsSection();
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

function renderMoreSuggestions(): void {
  const { maxSuggestionsToRender: suggestionsToRender, suggestionsRenderLimit } = hangoutSuggestionState;
  hangoutSuggestionState.maxSuggestionsToRender = Math.min(suggestionsRenderLimit, suggestionsToRender + 20);

  renderHangoutSuggestions();
};

function initSuggestionsSectionMutationObserver(): void {
  if (!suggestionsSectionElement) {
    return;
  };

  const mutationObserver: MutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class' && suggestionsSectionElement.classList.contains('hidden')) {
        hangoutSuggestionState.maxSuggestionsToRender = 10;
        hangoutSuggestionState.suggestionsSectionMutationObserverActive = false;

        mutationObserver.disconnect();
        return;
      };
    };
  });

  mutationObserver.observe(suggestionsSectionElement, { attributes: true, attributeFilter: ['class'] });
  hangoutSuggestionState.suggestionsSectionMutationObserverActive = true;
};

async function handleVoteBtnClicks(suggestion: Suggestion, suggestionElement: HTMLDivElement): Promise<void> {
  const isVotedFor: boolean = hangoutSuggestionState.memberVotesSet.has(suggestion.suggestion_id);

  if (!isVotedFor) {
    await addHangoutVote(suggestion, suggestionElement);
    return;
  };

  await removeHangoutVote(suggestion, suggestionElement);
};

async function addHangoutVote(suggestion: Suggestion, suggestionElement: HTMLDivElement): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutDetails, votesCount, hangoutId, hangoutMemberId } = globalHangoutState.data;

  if (hangoutDetails.current_stage !== HANGOUT_VOTING_STAGE) {
    popup('Not in voting stage.', 'error');
    LoadingModal.remove();

    return;
  };

  if (votesCount >= HANGOUT_VOTES_LIMIT) {
    popup(`Vote limit of ${HANGOUT_VOTES_LIMIT} reached.`, 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await addHangoutVoteService({ suggestionId: suggestion.suggestion_id, hangoutMemberId, hangoutId });

    globalHangoutState.data.votesCount++;
    suggestion.votes_count++;
    hangoutSuggestionState.memberVotesSet.add(suggestion.suggestion_id);

    updateSuggestionVoteValues(suggestionElement, suggestion.votes_count, true);
    updateRemainingVotesCount();

    popup('Vote added.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 403) {
      if (errReason === 'inAvailabilityStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_AVAILABILITY_STAGE;
        renderSuggestionsSection();

        return;
      };

      if (errReason === 'inSuggestionStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_SUGGESTIONS_STAGE;
        renderSuggestionsSection();

        return;
      };

      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
      globalHangoutState.data.hangoutDetails.is_concluded = true;

      renderSuggestionsSection();
      return;
    };

    if (status === 409) {
      globalHangoutState.data.votesCount = HANGOUT_VOTES_LIMIT;
      return;
    };

    if (status === 404) {
      LoadingModal.display();

      if (errReason === 'hangoutNotFound') {
        setTimeout(() => window.location.reload(), 1000);
        return;
      };

      hangoutSuggestionState.suggestions = hangoutSuggestionState.suggestions.filter((existingSuggestion: Suggestion) => existingSuggestion.suggestion_id !== suggestion.suggestion_id);

      renderSuggestionsSection();
      LoadingModal.remove();

      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionExpired();
    };
  };
};

async function removeHangoutVote(suggestion: Suggestion, suggestionElement: HTMLDivElement): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutDetails, hangoutId, hangoutMemberId } = globalHangoutState.data;

  if (hangoutDetails.current_stage !== HANGOUT_VOTING_STAGE) {
    popup('Not in voting stage.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await removeHangoutVoteService({ suggestionId: suggestion.suggestion_id, hangoutMemberId, hangoutId });

    globalHangoutState.data.votesCount--;
    suggestion.votes_count--;
    hangoutSuggestionState.memberVotesSet.delete(suggestion.suggestion_id);

    updateSuggestionVoteValues(suggestionElement, suggestion.votes_count, false);
    updateRemainingVotesCount();

    if (suggestionFiltersState.filterByVotedFor) {
      renderSuggestionsSection();
    };

    popup('Vote removed.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 403) {
      if (errReason === 'inAvailabilityStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_AVAILABILITY_STAGE;
        renderSuggestionsSection();

        return;
      };

      if (errReason === 'inSuggestionStage') {
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_SUGGESTIONS_STAGE;
        renderSuggestionsSection();

        return;
      };

      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;
      globalHangoutState.data.hangoutDetails.is_concluded = true;

      renderSuggestionsSection();
      return;
    };

    if (status === 404) {
      LoadingModal.display();

      if (errReason === 'hangoutNotFound') {
        setTimeout(() => window.location.reload(), 1000);
        return;
      };

      hangoutSuggestionState.suggestions = hangoutSuggestionState.suggestions.filter((existingSuggestion: Suggestion) => existingSuggestion.suggestion_id !== suggestion.suggestion_id);

      renderSuggestionsSection();
      LoadingModal.remove();

      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionExpired();
    };
  };
};

function toggleSuggestionExpansion(suggestionElement: HTMLDivElement): void {
  const viewSuggestionBtn: HTMLButtonElement | null = suggestionElement.querySelector('.view-suggestion-btn');

  if (suggestionElement.classList.contains('expanded')) {
    suggestionElement.classList.remove('expanded');
    viewSuggestionBtn && (viewSuggestionBtn.textContent = 'View description');

    return;
  };

  suggestionElement.classList.add('expanded');
  viewSuggestionBtn && (viewSuggestionBtn.textContent = 'Hide description');
};

export function removeOutOfBoundsSuggestions(newConclusionTimestamp: number): void {
  if (!globalHangoutState.data) {
    return;
  };

  globalHangoutState.data.suggestionsCount = 0;
  const inBoundsSuggestions: Suggestion[] = [];

  for (const suggestion of hangoutSuggestionState.suggestions) {
    if (suggestion.suggestion_start_timestamp < newConclusionTimestamp) {
      hangoutSuggestionState.memberLikesSet.delete(suggestion.suggestion_id);
      const voteDeleted: boolean = hangoutSuggestionState.memberVotesSet.delete(suggestion.suggestion_id);

      voteDeleted && globalHangoutState.data.votesCount--;
      continue;
    };

    inBoundsSuggestions.push(suggestion);

    if (suggestion.hangout_member_id === globalHangoutState.data.hangoutMemberId) {
      globalHangoutState.data.suggestionsCount++;
    };
  };

  hangoutSuggestionState.suggestions = inBoundsSuggestions;
  renderSuggestionsSection();
};