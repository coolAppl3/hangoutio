import { createDivElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { globalHangoutState } from "../globalHangoutState";
import { Suggestion } from "../hangoutTypes";
import { hangoutSuggestionState, renderSuggestionsSection } from "./hangoutSuggestions";
import { createSuggestionsMemberFilterItem } from "./suggestionsUtils";

interface HangoutSuggestionsFilterState {
  filterByLiked: boolean,
  filterByVotedFor: boolean,

  memberFiltersApplied: boolean,

  mainFilteredMembersSet: Set<number>,
  tempFilteredMembersSet: Set<number>,
};

export const hangoutSuggestionsFilterState: HangoutSuggestionsFilterState = {
  filterByLiked: false,
  filterByVotedFor: false,

  memberFiltersApplied: false,

  mainFilteredMembersSet: new Set<number>(),
  tempFilteredMembersSet: new Set<number>(),
};

const suggestionFiltersElement: HTMLDivElement | null = document.querySelector('#suggestion-filters');
const suggestionsMembersFilterContainer: HTMLDivElement | null = document.querySelector('#suggestions-members-filter-container');

const suggestionFiltersApplyBtn: HTMLButtonElement | null = document.querySelector('#suggestion-filters-apply-btn');
const filterByLikedBtn: HTMLButtonElement | null = document.querySelector('#filter-by-liked-btn');
const filterByVotedForBtn: HTMLButtonElement | null = document.querySelector('#filter-by-voted-for-btn');

export function initHangoutSuggestionsFilter(): void {
  if (!globalHangoutState.data) {
    return;
  };

  renderMembersFilter();
  loadEventListeners();
};

export function renderMembersFilter(): void {
  if (!suggestionsMembersFilterContainer || !globalHangoutState.data) {
    return;
  };

  const { hangoutMemberId, hangoutMembers } = globalHangoutState.data;
  const filterContainer: HTMLDivElement = createDivElement('filter-container');

  for (const member of hangoutMembers) {
    const isFiltered: boolean = hangoutSuggestionsFilterState.mainFilteredMembersSet.has(member.hangout_member_id);
    const isUser: boolean = hangoutMemberId === member.hangout_member_id

    filterContainer.appendChild(createSuggestionsMemberFilterItem(member.hangout_member_id, member.display_name, isFiltered, isUser));
  };

  const orphanSuggestionsFiltered: boolean = hangoutSuggestionsFilterState.mainFilteredMembersSet.has(0);
  filterContainer.appendChild(createSuggestionsMemberFilterItem(0, 'Previous members', orphanSuggestionsFiltered, false));

  suggestionsMembersFilterContainer.firstElementChild?.remove();
  suggestionsMembersFilterContainer.appendChild(filterContainer);
};

function loadEventListeners(): void {
  suggestionFiltersElement?.addEventListener('click', handleSuggestionFiltersClicks);
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
    hangoutSuggestionsFilterState.tempFilteredMembersSet.delete(+hangoutMemberId);
    detectFilterChanges();

    return;
  };

  hangoutSuggestionsFilterState.tempFilteredMembersSet.add(+hangoutMemberId);
  detectFilterChanges();
};

function applySuggestionFilters(): void {
  LoadingModal.display();

  if (allFiltersRemoved()) {
    hangoutSuggestionsFilterState.mainFilteredMembersSet.clear();
    hangoutSuggestionsFilterState.tempFilteredMembersSet.clear();

    hangoutSuggestionsFilterState.filterByLiked = false;
    hangoutSuggestionsFilterState.filterByVotedFor = false;

    hangoutSuggestionsFilterState.memberFiltersApplied = false;

    switchApplyFiltersBtn(false);
    closeFilterDropdown();

    renderSuggestionsSection();

    popup('Filters removed.', 'success');
    LoadingModal.remove();

    return;
  };

  const { utilityChangesFound, memberChangesFound } = detectFilterChanges();
  if (!utilityChangesFound && !memberChangesFound) {
    switchApplyFiltersBtn(false);
    closeFilterDropdown();

    popup('No changes to apply.', 'error');
    LoadingModal.remove();

    return;
  };

  const { filterByLiked, filterByVotedFor } = getUtilityFilters();

  hangoutSuggestionsFilterState.filterByLiked = filterByLiked;
  hangoutSuggestionsFilterState.filterByVotedFor = filterByVotedFor;
  hangoutSuggestionsFilterState.mainFilteredMembersSet = new Set(...[hangoutSuggestionsFilterState.tempFilteredMembersSet]);

  if (hangoutSuggestionsFilterState.mainFilteredMembersSet.size === 0) {
    hangoutSuggestionsFilterState.memberFiltersApplied = false;

  } else {
    hangoutSuggestionsFilterState.memberFiltersApplied = true;
  };

  switchApplyFiltersBtn(false);
  closeFilterDropdown();

  renderSuggestionsSection();

  popup('Filters applied.', 'success');
  LoadingModal.remove();
};

export function filterSuggestions(suggestions: Suggestion[]): Suggestion[] {
  const { filterByLiked, filterByVotedFor, memberFiltersApplied, mainFilteredMembersSet } = hangoutSuggestionsFilterState;
  const { memberLikesSet, memberVotesSet } = hangoutSuggestionState;

  return suggestions.filter((suggestion: Suggestion) => {
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

function getUtilityFilters(): { filterByLiked: boolean, filterByVotedFor: boolean } {
  if (!filterByLikedBtn || !filterByVotedForBtn) {
    return { filterByLiked: false, filterByVotedFor: false };
  };

  const filterByLiked: boolean = filterByLikedBtn.classList.contains('checked');
  const filterByVotedFor: boolean = filterByVotedForBtn.classList.contains('checked');

  return { filterByLiked, filterByVotedFor };
};

function detectFilterChanges(): { utilityChangesFound: boolean, memberChangesFound: boolean } {
  const { mainFilteredMembersSet, tempFilteredMembersSet } = hangoutSuggestionsFilterState;
  const { filterByLiked, filterByVotedFor } = getUtilityFilters();

  let utilityChangesFound: boolean = false;
  let memberChangesFound: boolean = false;

  if (
    hangoutSuggestionsFilterState.filterByLiked !== filterByLiked ||
    hangoutSuggestionsFilterState.filterByVotedFor !== filterByVotedFor
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
  if (hangoutSuggestionsFilterState.tempFilteredMembersSet.size !== 0) {
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
    suggestionFiltersApplyBtn.setAttribute('disabled', '');

    return;
  };

  suggestionFiltersApplyBtn.classList.remove('disabled');
  suggestionFiltersApplyBtn.removeAttribute('disabled');
};

function closeFilterDropdown(): void {
  suggestionFiltersElement?.classList.remove('expanded');
};