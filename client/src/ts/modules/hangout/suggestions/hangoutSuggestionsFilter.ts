import { createDivElement } from "../../global/domUtils";
import { globalHangoutState } from "../globalHangoutState";
import { createSuggestionsMemberFilterItem } from "./suggestionsUtils";

interface HangoutSuggestionsFilterState {
  filterByLiked: boolean,
  filterByVotedFor: boolean,

  filteredMembersSet: Set<number>,
};

const hangoutSuggestionsFilterState: HangoutSuggestionsFilterState = {
  filterByLiked: false,
  filterByVotedFor: false,

  filteredMembersSet: new Set<number>(),
};

const suggestionsMembersFilterContainer: HTMLDivElement | null = document.querySelector('#suggestions-members-filter-container');

export function initHangoutSuggestionsFilter(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const { hangoutMemberId, hangoutMembers } = globalHangoutState.data;
  hangoutSuggestionsFilterState.filteredMembersSet.add(hangoutMemberId);

  for (const member of hangoutMembers) {
    hangoutSuggestionsFilterState.filteredMembersSet.add(member.hangout_member_id);
  };

  renderMembersFilter();
};

export function renderMembersFilter(): void {
  if (!suggestionsMembersFilterContainer || !globalHangoutState.data) {
    return;
  };

  const { hangoutMemberId, hangoutMembers } = globalHangoutState.data;
  const filterContainer: HTMLDivElement = createDivElement('filter-container');

  for (const member of hangoutMembers) {
    if (member.hangout_member_id === hangoutMemberId) {
      filterContainer.appendChild(createSuggestionsMemberFilterItem(member.hangout_member_id, member.display_name, true));
    };

    filterContainer.appendChild(createSuggestionsMemberFilterItem(member.hangout_member_id, member.display_name));
  };

  suggestionsMembersFilterContainer.firstElementChild?.remove();
  suggestionsMembersFilterContainer.appendChild(filterContainer);
};