import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_SUGGESTIONS_STAGE } from "../../global/clientConstants";
import { debounce } from "../../global/debounce";
import { createDivElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { globalHangoutState } from "../globalHangoutState";
import { Suggestion } from "../hangoutTypes";
import { hangoutSuggestionState, renderSuggestionsSection } from "./hangoutSuggestions";
import { createSuggestionsMemberFilterItem } from "./suggestionsUtils";

interface SuggestionFiltersState {
  memberFiltersApplied: boolean,

  filterByLiked: boolean,
  filterByVotedFor: boolean,

  mainFilteredMembersSet: Set<number>,
  tempFilteredMembersSet: Set<number>,

  sortingMode: 'likes' | 'votes',
  searchQuery: string,
};

export const suggestionFiltersState: SuggestionFiltersState = {
  memberFiltersApplied: false,

  filterByLiked: false,
  filterByVotedFor: false,

  mainFilteredMembersSet: new Set<number>(),
  tempFilteredMembersSet: new Set<number>(),

  sortingMode: 'likes',
  searchQuery: '',
};

const suggestionFiltersElement: HTMLDivElement | null = document.querySelector('#suggestion-filters');
const suggestionsMembersFilterContainer: HTMLDivElement | null = document.querySelector('#suggestions-members-filter-container');

const suggestionFiltersApplyBtn: HTMLButtonElement | null = document.querySelector('#suggestion-filters-apply-btn');
const filterByLikedBtn: HTMLButtonElement | null = document.querySelector('#filter-by-liked-btn');
const filterByVotedForBtn: HTMLButtonElement | null = document.querySelector('#filter-by-voted-for-btn');

const suggestionsSortElement: HTMLDivElement | null = document.querySelector('#suggestions-sort');
const suggestionsSortContainerBtn: HTMLButtonElement | null = document.querySelector('#suggestions-sort-container-btn');

const suggestionsSearchInput: HTMLInputElement | null = document.querySelector('#suggestions-search-input');

export function initHangoutSuggestionsFilter(): void {
  if (!globalHangoutState.data) {
    return;
  };

  renderMemberFilters();
  loadEventListeners();
};

export function renderMemberFilters(): void {
  if (!suggestionsMembersFilterContainer || !globalHangoutState.data) {
    return;
  };

  const { hangoutMemberId, hangoutMembers } = globalHangoutState.data;
  const filterContainer: HTMLDivElement = createDivElement('filter-container');

  for (const member of hangoutMembers) {
    const isFiltered: boolean = suggestionFiltersState.mainFilteredMembersSet.has(member.hangout_member_id);
    const isUser: boolean = hangoutMemberId === member.hangout_member_id

    filterContainer.appendChild(createSuggestionsMemberFilterItem(member.hangout_member_id, member.display_name, isFiltered, isUser));
  };

  const orphanSuggestionsFiltered: boolean = suggestionFiltersState.mainFilteredMembersSet.has(0);
  filterContainer.appendChild(createSuggestionsMemberFilterItem(0, 'Previous members', orphanSuggestionsFiltered, false));

  suggestionsMembersFilterContainer.firstElementChild?.remove();
  suggestionsMembersFilterContainer.appendChild(filterContainer);
};

function loadEventListeners(): void {
  suggestionFiltersElement?.addEventListener('click', handleSuggestionFiltersClicks);
  suggestionsSearchInput?.addEventListener('keyup', searchSuggestions);
};

function handleSuggestionFiltersClicks(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'suggestion-filters-btn') {
    e.target.parentElement?.parentElement?.classList.toggle('expanded');
    return;
  };

  if (e.target.classList.contains('checkbox-btn')) {
    handleCheckboxClicks(e.target);
    return;
  };

  if (e.target.id === 'suggestion-filters-apply-btn') {
    applySuggestionFilters();
    return;
  };

  if (e.target.id === 'suggestion-filters-reset-btn') {
    resetSuggestionFilters();
    return;
  };

  if (e.target.id === 'suggestion-filters-cancel-btn') {
    cancelFilterChanges();
  };

  // sorting buttons
  if (e.target.id === 'suggestions-sort-container-btn') {
    e.target.parentElement?.parentElement?.classList.toggle('expanded');
    return;
  };

  if (e.target.classList.contains('suggestions-sort-btn')) {
    handleSuggestionsSortClicks(e.target);
  };
};

function handleCheckboxClicks(checkboxBtn: HTMLButtonElement): void {
  const isChecked: boolean = checkboxBtn.classList.contains('checked');
  checkboxBtn.classList.toggle('checked');

  if (!checkboxBtn.classList.contains('member-filter-btn')) {
    detectFilterChanges();
    return;
  };

  const hangoutMemberId: string | null = checkboxBtn.getAttribute('data-memberId');

  if (!hangoutMemberId || !Number.isInteger(+hangoutMemberId)) {
    return;
  };

  if (isChecked) {
    suggestionFiltersState.tempFilteredMembersSet.delete(+hangoutMemberId);
    detectFilterChanges();

    return;
  };

  suggestionFiltersState.tempFilteredMembersSet.add(+hangoutMemberId);
  detectFilterChanges();
};

export function filterSuggestions(suggestions: Suggestion[]): Suggestion[] {
  const { searchQuery, filterByLiked, filterByVotedFor, memberFiltersApplied, mainFilteredMembersSet } = suggestionFiltersState;
  const { memberLikesSet, memberVotesSet } = hangoutSuggestionState;

  return suggestions.filter((suggestion: Suggestion) => {
    if (!suggestion.suggestion_title.toLowerCase().includes(searchQuery)) {
      return false;
    };

    if (memberFiltersApplied && !mainFilteredMembersSet.has(suggestion.hangout_member_id || 0)) {
      return false;
    };

    if (!filterByLiked && !filterByVotedFor) {
      return true;
    };

    const isLiked: boolean = memberLikesSet.has(suggestion.suggestion_id);
    const isVotedFor: boolean = memberVotesSet.has(suggestion.suggestion_id);

    if (isLiked && filterByLiked) {
      return true;
    };

    if (isVotedFor && filterByVotedFor) {
      return true;
    };

    return false;
  });
};


function applySuggestionFilters(): void {
  LoadingModal.display();

  if (allFiltersRemoved()) {
    suggestionFiltersState.mainFilteredMembersSet.clear();
    suggestionFiltersState.tempFilteredMembersSet.clear();

    suggestionFiltersState.filterByLiked = false;
    suggestionFiltersState.filterByVotedFor = false;

    suggestionFiltersState.memberFiltersApplied = false;

    switchApplyFiltersBtn(false);
    collapseFilterDropdown();

    renderSuggestionsSection();

    popup('Filters removed.', 'success');
    LoadingModal.remove();

    return;
  };

  const { utilityChangesFound, memberChangesFound } = detectFilterChanges();
  if (!utilityChangesFound && !memberChangesFound) {
    switchApplyFiltersBtn(false);
    collapseFilterDropdown();

    popup('No changes to apply.', 'error');
    LoadingModal.remove();

    return;
  };

  const { filterByLiked, filterByVotedFor } = getUtilityFilters();

  suggestionFiltersState.filterByLiked = filterByLiked;
  suggestionFiltersState.filterByVotedFor = filterByVotedFor;
  suggestionFiltersState.mainFilteredMembersSet = new Set(...[suggestionFiltersState.tempFilteredMembersSet]);

  if (suggestionFiltersState.mainFilteredMembersSet.size === 0) {
    suggestionFiltersState.memberFiltersApplied = false;

  } else {
    suggestionFiltersState.memberFiltersApplied = true;
  };

  switchApplyFiltersBtn(false);
  collapseFilterDropdown();

  renderSuggestionsSection();

  popup('Filters applied.', 'success');
  LoadingModal.remove();
};

function cancelFilterChanges(): void {
  const { utilityChangesFound, memberChangesFound } = detectFilterChanges();
  const { filterByLiked, filterByVotedFor } = suggestionFiltersState;

  collapseFilterDropdown();

  if (!utilityChangesFound && !memberChangesFound) {
    return;
  };

  memberChangesFound && renderMemberFilters();

  filterByLiked
    ? filterByLikedBtn?.classList.add('checked')
    : filterByLikedBtn?.classList.remove('checked');
  //

  filterByVotedFor
    ? filterByVotedForBtn?.classList.add('checked')
    : filterByVotedForBtn?.classList.remove('checked');
  //

  suggestionFiltersState.tempFilteredMembersSet = new Set(...[suggestionFiltersState.mainFilteredMembersSet]);
  detectFilterChanges();
};

function resetSuggestionFilters(): void {
  suggestionFiltersState.filterByLiked = false;
  suggestionFiltersState.filterByVotedFor = false;

  suggestionFiltersState.tempFilteredMembersSet.clear();
  suggestionFiltersState.mainFilteredMembersSet.clear();
  suggestionFiltersState.memberFiltersApplied = false;

  LoadingModal.display();

  collapseFilterDropdown();
  clearUtilityFilters();
  renderMemberFilters();

  renderSuggestionsSection();

  popup('Filters reset.', 'success');
  LoadingModal.remove();
};

function clearUtilityFilters(): void {
  if (!filterByLikedBtn || !filterByVotedForBtn) {
    return;
  };

  filterByLikedBtn.classList.remove('checked');
  filterByVotedForBtn.classList.remove('checked');
};

function getUtilityFilters(): { filterByLiked: boolean, filterByVotedFor: boolean } {
  if (!filterByLikedBtn || !filterByVotedForBtn) {
    return { filterByLiked: false, filterByVotedFor: false };
  };

  const filterByLiked: boolean = filterByLikedBtn.classList.contains('checked');
  const filterByVotedFor: boolean = filterByVotedForBtn.classList.contains('checked');

  return { filterByLiked, filterByVotedFor };
};

function detectFilterChanges(): { utilityChangesFound: boolean, memberChangesFound: boolean } {
  const { mainFilteredMembersSet, tempFilteredMembersSet } = suggestionFiltersState;
  const { filterByLiked, filterByVotedFor } = getUtilityFilters();

  let utilityChangesFound: boolean = false;
  let memberChangesFound: boolean = false;

  if (
    suggestionFiltersState.filterByLiked !== filterByLiked ||
    suggestionFiltersState.filterByVotedFor !== filterByVotedFor
  ) {
    utilityChangesFound = true;
  };

  if (
    mainFilteredMembersSet.size !== tempFilteredMembersSet.size ||
    ![...mainFilteredMembersSet].every((id: number) => tempFilteredMembersSet.has(id))
  ) {
    memberChangesFound = true;
  };

  if (utilityChangesFound || memberChangesFound) {
    switchApplyFiltersBtn(true);

  } else {
    switchApplyFiltersBtn(false);
  };

  return { utilityChangesFound, memberChangesFound };
};

function allFiltersRemoved(): boolean {
  if (suggestionFiltersState.tempFilteredMembersSet.size !== 0) {
    return false;
  };

  const { filterByLiked, filterByVotedFor } = getUtilityFilters();
  if (filterByLiked || filterByVotedFor) {
    return false;
  };

  return true;
};

function switchApplyFiltersBtn(enable: boolean): void {
  if (!suggestionFiltersApplyBtn) {
    return;
  };

  if (!enable) {
    suggestionFiltersApplyBtn.classList.add('disabled');
    suggestionFiltersApplyBtn.disabled = true;

    return;
  };

  suggestionFiltersApplyBtn.classList.remove('disabled');
  suggestionFiltersApplyBtn.disabled = false;
};

function collapseFilterDropdown(): void {
  suggestionFiltersElement?.classList.remove('expanded');
};

// sorting
export function sortHangoutSuggestions(): void {
  const sortMode: 'likes' | 'votes' = suggestionFiltersState.sortingMode;
  hangoutSuggestionState.suggestions.sort((a, b) => b[`${sortMode}_count`] - a[`${sortMode}_count`]);
};

function handleSuggestionsSortClicks(sortBtn: HTMLButtonElement): void {
  const current_stage: number | undefined = globalHangoutState.data?.hangoutDetails.current_stage;
  const sortBy: string | null = sortBtn.getAttribute('data-sortBy');

  if (sortBy !== 'likes' && sortBy !== 'votes') {
    return;
  };

  if (sortBy === 'likes' && current_stage === HANGOUT_AVAILABILITY_STAGE) {
    popup('No likes found to sort by.', 'error');
    collapseSortingContainer();

    return;
  };

  if (sortBy === 'votes' && (current_stage === HANGOUT_AVAILABILITY_STAGE || current_stage === HANGOUT_SUGGESTIONS_STAGE)) {
    popup('No votes found to sort by.', 'error');
    collapseSortingContainer();

    return;
  };

  LoadingModal.display();

  collapseSortingContainer();
  suggestionsSortContainerBtn?.firstElementChild && (suggestionsSortContainerBtn.firstElementChild.textContent = `Most ${sortBy}`);

  suggestionFiltersState.sortingMode = sortBy;
  sortHangoutSuggestions();
  renderSuggestionsSection();

  popup(`Sorted by most ${sortBy}.`, 'success');
  LoadingModal.remove();
};

function collapseSortingContainer(): void {
  suggestionsSortElement?.classList.remove('expanded');
};

// search
function searchSuggestions(): void {
  if (!suggestionsSearchInput) {
    return;
  };

  const searchQuery: string = suggestionsSearchInput.value;
  debounceSearch(searchQuery);
};

const debounceSearch = debounce(showSearchResults, 300);

function showSearchResults(searchQuery: string): void {
  suggestionFiltersState.searchQuery = searchQuery.toLowerCase();
  renderSuggestionsSection();
};