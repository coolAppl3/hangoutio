import { createBtnElement, createDivElement, createParagraphElement, createSpanElement, createSvgElement } from "../../global/domUtils";
import { globalHangoutState } from "../globalHangoutState";
import { getDateAndTimeString } from "../../global/dateTimeUtils";
import { Suggestion } from "../hangoutTypes";
import { hangoutSuggestionState } from "./hangoutSuggestions";
import { HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE } from "../../global/clientConstants";

export function updateSuggestionLikeBtnAttributes(suggestionElement: HTMLDivElement): void {
  const likeBtn: HTMLButtonElement | null = suggestionElement.querySelector('button.like-suggestion-btn');

  if (!likeBtn) {
    return;
  };

  const isLiked: boolean = likeBtn.classList.contains('liked');

  likeBtn.setAttribute('title', isLiked ? 'Unlike suggestion' : 'Like suggestion');
  likeBtn.setAttribute('aria-label', isLiked ? 'Unlike suggestion' : 'Like suggestion');
};

export function updateSuggestionDropdownMenuBtnAttributes(suggestionElement: HTMLDivElement): void {
  const dropdownMenuBtn: HTMLButtonElement | null = suggestionElement.querySelector('button.like-suggestion-btn');

  if (!dropdownMenuBtn) {
    return;
  };

  const isExpanded: boolean = dropdownMenuBtn.parentElement?.classList.contains('expanded') === true;

  dropdownMenuBtn.setAttribute('title', isExpanded ? 'Collapse suggestion options' : 'Expand suggestion options');
  dropdownMenuBtn.setAttribute('aria-label', isExpanded ? 'Collapse suggestion options' : 'Expand suggestion options');
};

export function displaySuggestionLikeIcon(suggestionElement: HTMLDivElement): void {
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

export function removeSuggestionLikeIcon(suggestionElement: HTMLDivElement): void {
  const suggestionLikesCountSpan: HTMLSpanElement | null = suggestionElement.querySelector('.rating-container span');

  if (!suggestionLikesCountSpan) {
    return;
  };

  const suggestionLikesCountString: string | null = suggestionLikesCountSpan.textContent;

  if (!suggestionLikesCountString || !Number.isInteger(+suggestionLikesCountString)) {
    return;
  };

  const suggestionLikesCount: number = +suggestionLikesCountString;
  suggestionLikesCountSpan.textContent = `${Math.max(suggestionLikesCount - 1, 0)}`;

  suggestionElement.classList.remove('like-pending', 'liked');
};

// vote utils
export function updateSuggestionVoteValues(suggestionElement: HTMLDivElement, newVotesCount: number, voteAdded: boolean): void {
  const votesCountSpan: HTMLSpanElement | null = suggestionElement.querySelector('.votes-count-span');
  const toggleVoteBtn: HTMLButtonElement | null = suggestionElement.querySelector('.toggle-vote-btn');

  votesCountSpan && (votesCountSpan.textContent = `${newVotesCount}`);

  if (!toggleVoteBtn) {
    return;
  };

  if (voteAdded) {
    toggleVoteBtn.classList.add('danger');
    toggleVoteBtn.textContent = 'Remove vote';

    return;
  };

  toggleVoteBtn.classList.remove('danger');
  toggleVoteBtn.textContent = 'Add vote'
};

export function updateSuggestionsFormHeader(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const currentStage: number = globalHangoutState.data.hangoutDetails.current_stage;

  if (currentStage <= HANGOUT_SUGGESTIONS_STAGE) {
    return;
  };

  const suggestionsFormHeader: HTMLDivElement | null = document.querySelector('#suggestions-form-header');
  const setStage: string | null | undefined = suggestionsFormHeader?.getAttribute('data-currentStage');

  if (setStage && currentStage === +setStage) {
    return;
  };

  const titleElement: HTMLHeadingElement | null | undefined = suggestionsFormHeader?.querySelector('.title');
  const descriptionElement: HTMLParagraphElement | null | undefined = suggestionsFormHeader?.querySelector('.description');
  const suggestionsFormHeaderBtn: HTMLButtonElement | null | undefined = suggestionsFormHeader?.querySelector('button.btn');

  if (!suggestionsFormHeader || !titleElement || !descriptionElement || !suggestionsFormHeaderBtn) {
    return;
  };

  suggestionsFormHeader.setAttribute('data-currentStage', `${currentStage}`);
  descriptionElement.classList.add('hidden');

  if (currentStage === HANGOUT_VOTING_STAGE) {
    titleElement.textContent = 'Vote on your favorite suggestions.';
    suggestionsFormHeaderBtn.classList.add('hidden');

    return;
  };

  titleElement.textContent = 'Hangout has been concluded!';
  suggestionsFormHeaderBtn.textContent = 'View winning suggestion';
  suggestionsFormHeaderBtn.classList.remove('hidden');
};

// suggestions-related DOM utils
export function createSuggestionElement(suggestion: Suggestion, isLeader: boolean): HTMLDivElement {
  const suggestionElement: HTMLDivElement = createDivElement('suggestion');
  suggestionElement.setAttribute('data-suggestionId', `${suggestion.suggestion_id}`);

  if (suggestion.hangout_member_id === globalHangoutState.data?.hangoutMemberId) {
    suggestionElement.classList.add('user');
  };

  const isLiked: boolean = hangoutSuggestionState.memberLikesSet.has(suggestion.suggestion_id);
  if (isLiked) {
    suggestionElement.classList.add('liked');
  };

  suggestionElement.appendChild(createSuggestionDetailsElement(suggestion, isLeader, isLiked));
  suggestionElement.appendChild(createParagraphElement('suggestion-description', suggestion.suggestion_description));

  return suggestionElement;
};

function createSuggestionDetailsElement(suggestion: Suggestion, isLeader: boolean, isLiked: boolean): HTMLDivElement {
  const suggestionDetailsElement: HTMLDivElement = createDivElement('suggestion-details');
  const isVotedFor: boolean = hangoutSuggestionState.memberVotesSet.has(suggestion.suggestion_id);

  const suggestionDetailsHeaderElement: HTMLDivElement = createDivElement('suggestion-details-header');
  suggestionDetailsHeaderElement.appendChild(createParagraphElement('suggestion-title', suggestion.suggestion_title));
  suggestionDetailsHeaderElement.appendChild(createRatingContainer(suggestion.likes_count, isLiked));

  const isMemberSuggestion: boolean = globalHangoutState.data?.hangoutMemberId === suggestion.hangout_member_id;
  if ((isLeader || isMemberSuggestion) && !globalHangoutState.data?.hangoutDetails.is_concluded) {
    suggestionDetailsHeaderElement.appendChild(createDropdownMenuElement(isMemberSuggestion));
  };

  suggestionDetailsElement.appendChild(suggestionDetailsHeaderElement);
  suggestionDetailsElement.appendChild(createSuggestionDetailsContainer(suggestion));
  suggestionDetailsElement.appendChild(createBtnContainer(isVotedFor));
  suggestion.is_edited && suggestionDetailsElement.appendChild(createSpanElement('is-edited-span', 'Edited'));

  return suggestionDetailsElement;
};

function createRatingContainer(likesCount: number, isLiked: boolean): HTMLDivElement {
  const ratingContainer: HTMLDivElement = createDivElement('rating-container');

  const likeSuggestionBtn: HTMLButtonElement = createBtnElement('like-suggestion-btn', null);
  likeSuggestionBtn.setAttribute('title', isLiked ? 'Unlike suggestion' : 'Like suggestion');
  likeSuggestionBtn.setAttribute('aria-label', isLiked ? 'Unlike suggestion' : 'Like suggestion');
  likeSuggestionBtn.appendChild(createLikeIcon());
  likeSuggestionBtn.appendChild(createDivElement('like-spinner'));

  if (globalHangoutState.data?.hangoutDetails.is_concluded) {
    likeSuggestionBtn.classList.add('disabled');
    likeSuggestionBtn.disabled = true;
  };

  ratingContainer.appendChild(createSpanElement('suggestion-likes-count', `${likesCount}`));
  ratingContainer.appendChild(likeSuggestionBtn);

  return ratingContainer;
};

function createDropdownMenuElement(isMemberSuggestion: boolean): HTMLDivElement {
  const dropdownMenuElement: HTMLDivElement = createDivElement('dropdown-menu');

  const dropdownMenuBtn: HTMLButtonElement = createBtnElement('dropdown-menu-btn', null);
  dropdownMenuBtn.setAttribute('title', 'Expand suggestion options');
  dropdownMenuBtn.setAttribute('aria-label', 'Expand suggestion options');
  dropdownMenuBtn.appendChild(createDropdownIcon());

  const dropdownMenuList: HTMLDivElement = createDivElement('dropdown-menu-list');
  isMemberSuggestion && dropdownMenuList.appendChild(createBtnElement('edit-btn', 'Edit'));

  if (globalHangoutState.data?.hangoutDetails.current_stage === HANGOUT_SUGGESTIONS_STAGE) {
    dropdownMenuList.appendChild(createBtnElement('delete-btn', isMemberSuggestion ? 'Delete' : 'Delete as leader'));
  };

  dropdownMenuElement.appendChild(dropdownMenuBtn);
  dropdownMenuElement.appendChild(dropdownMenuList);

  return dropdownMenuElement;
};

function createSuggestionDetailsContainer(suggestion: Suggestion): HTMLDivElement {
  const suggestionDetailsContainer: HTMLDivElement = createDivElement('suggestion-details-container');

  const firstItem: HTMLDivElement = createDivElement(null);
  firstItem.appendChild(createSpanElement(null, 'Start'));
  firstItem.appendChild(createSpanElement(null, getDateAndTimeString(suggestion.suggestion_start_timestamp)));

  const secondItem: HTMLDivElement = createDivElement(null);
  secondItem.appendChild(createSpanElement(null, 'End'));
  secondItem.appendChild(createSpanElement(null, getDateAndTimeString(suggestion.suggestion_end_timestamp)));

  const thirdItem: HTMLDivElement = createDivElement(null);
  thirdItem.appendChild(createSpanElement(null, 'Suggested by'));

  const suggestionMemberDisplayName: string | null | undefined = !suggestion.hangout_member_id ? null : globalHangoutState.data?.hangoutMembersMap.get(suggestion.hangout_member_id);
  thirdItem.appendChild(createSpanElement(null, suggestionMemberDisplayName ? suggestionMemberDisplayName : 'Former member'));

  suggestionDetailsContainer.appendChild(firstItem);
  suggestionDetailsContainer.appendChild(secondItem);
  suggestionDetailsContainer.appendChild(thirdItem);

  if (globalHangoutState.data && globalHangoutState.data.hangoutDetails.current_stage >= HANGOUT_VOTING_STAGE) {
    const fourthItem: HTMLDivElement = createDivElement(null);
    fourthItem.appendChild(createSpanElement(null, 'Votes count'));
    fourthItem.appendChild(createSpanElement('votes-count-span', `${suggestion.votes_count}`));

    suggestionDetailsContainer.appendChild(fourthItem);
  };

  return suggestionDetailsContainer;
};

function createBtnContainer(isVotedFor: boolean): HTMLDivElement {
  const btnContainer: HTMLDivElement = createDivElement('btn-container');
  btnContainer.appendChild(createBtnElement('view-suggestion-btn', 'View details'));

  const toggleVoteBtn: HTMLButtonElement = createBtnElement('toggle-vote-btn', 'Add vote');

  if (isVotedFor) {
    toggleVoteBtn.classList.add('danger');
    toggleVoteBtn.textContent = 'Remove vote';
  };

  btnContainer.insertAdjacentElement('afterbegin', toggleVoteBtn);
  return btnContainer;
};

function createLikeIcon(): SVGSVGElement {
  const likeSvgElement: SVGSVGElement = createSvgElement(500, 500);
  const likePathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  likePathElement.setAttribute('stroke-width', '30');
  likePathElement.setAttribute('d', 'M231.098 395.508L231.087 395.498L231.076 395.488C179.281 348.521 137.498 310.548 108.489 275.057C79.6444 239.768 65 208.769 65 176C65 122.502 106.666 81 160 81C190.265 81 219.562 95.1669 238.617 117.369L250 130.631L261.383 117.369C280.438 95.1669 309.735 81 340 81C393.334 81 435 122.502 435 176C435 208.769 420.356 239.768 391.511 275.057C362.502 310.548 320.719 348.521 268.924 395.488L268.913 395.498L268.902 395.508L250 412.715L231.098 395.508Z');

  likeSvgElement.appendChild(likePathElement);
  return likeSvgElement;
};

function createDropdownIcon(): SVGSVGElement {
  const dropdownSvgElement: SVGSVGElement = createSvgElement(540, 540);

  const firstPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  firstPathElement.setAttribute('d', 'M330 70C330 103.137 303.137 130 270 130C236.863 130 210 103.137 210 70C210 36.8629 236.863 10 270 10C303.137 10 330 36.8629 330 70Z');

  const secondPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  secondPathElement.setAttribute('d', 'M330 270C330 303.137 303.137 330 270 330C236.863 330 210 303.137 210 270C210 236.863 236.863 210 270 210C303.137 210 330 236.863 330 270Z');

  const thirdPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  thirdPathElement.setAttribute('d', 'M330 470C330 503.137 303.137 530 270 530C236.863 530 210 503.137 210 470C210 436.863 236.863 410 270 410C303.137 410 330 436.863 330 470Z');

  dropdownSvgElement.appendChild(firstPathElement);
  dropdownSvgElement.appendChild(secondPathElement);
  dropdownSvgElement.appendChild(thirdPathElement);

  return dropdownSvgElement;
};

// filter-related DOM utils

export function createSuggestionsMemberFilterItem(hangoutMemberId: number, displayName: string, isFiltered: boolean, isUser: boolean): HTMLDivElement {
  const filterItem: HTMLDivElement = createDivElement('filter-item');

  const checkboxBtn: HTMLButtonElement = createBtnElement(`checkbox-btn member-filter-btn ${isFiltered ? 'checked' : ''}`, null);
  checkboxBtn.setAttribute('data-memberId', `${hangoutMemberId}`);
  checkboxBtn.setAttribute('aria-label', `Filter out ${displayName}`);

  const checkboxBtnDiv: HTMLDivElement = createDivElement('svg');
  checkboxBtnDiv.appendChild(createCheckIcon());

  checkboxBtn.appendChild(checkboxBtnDiv);

  filterItem.appendChild(checkboxBtn);
  filterItem.appendChild(createParagraphElement(null, isUser ? `${displayName} (you)` : displayName));

  return filterItem;
};

function createCheckIcon(): SVGSVGElement {
  const checkSvgElement: SVGSVGElement = createSvgElement(601, 601);

  const firstPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  firstPathElement.setAttribute('d', 'M106.645 335.421C87.1184 315.895 87.1184 284.237 106.645 264.711C126.171 245.184 157.829 245.184 177.355 264.711L318.777 406.132L283.421 441.487C263.895 461.014 232.237 461.014 212.711 441.487L106.645 335.421Z');

  const secondPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  secondPathElement.setAttribute('d', 'M177.355 406.132L424.843 158.645C444.369 139.118 476.027 139.118 495.553 158.645C515.08 178.171 515.08 209.829 495.553 229.355L283.421 441.487C263.895 461.014 232.237 461.014 212.711 441.487L177.355 406.132Z');

  checkSvgElement.appendChild(firstPathElement);
  checkSvgElement.appendChild(secondPathElement);

  return checkSvgElement;
};