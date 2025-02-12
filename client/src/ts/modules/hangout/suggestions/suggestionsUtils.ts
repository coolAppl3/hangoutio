import { createBtnElement, createDivElement, createParagraphElement, createSpanElement, createSvgElement } from "../../global/domUtils";
import { globalHangoutState } from "../globalHangoutState";
import { getDateAndTimeString } from "../../global/dateTimeUtils";
import { Suggestion } from "../hangoutTypes";
import { hangoutSuggestionState } from "./hangoutSuggestions";

export function createSuggestionElement(suggestion: Suggestion, isLeader: boolean): HTMLDivElement {
  const suggestionElement: HTMLDivElement = createDivElement('suggestion');
  suggestionElement.setAttribute('data-suggestionId', `${suggestion.suggestion_id || 0}`);

  if (suggestion.hangout_member_id === globalHangoutState.data?.hangoutMemberId) {
    suggestionElement.classList.add('user');
  };

  const isLiked: boolean = hangoutSuggestionState.memberLikesSet.has(suggestion.suggestion_id);
  if (isLiked) {
    suggestionElement.classList.add('liked');
  };

  suggestionElement.appendChild(createSuggestionDetailsElement(suggestion, isLeader));
  suggestionElement.appendChild(createParagraphElement('suggestion-description', suggestion.suggestion_description));

  return suggestionElement;
};

function createSuggestionDetailsElement(suggestion: Suggestion, isLeader: boolean): HTMLDivElement {
  const suggestionDetailsElement: HTMLDivElement = createDivElement('suggestion-details');
  const isVotedFor: boolean = hangoutSuggestionState.memberVotesSet.has(suggestion.suggestion_id);

  const suggestionDetailsHeaderElement: HTMLDivElement = createDivElement('suggestion-details-header');
  suggestionDetailsHeaderElement.appendChild(createParagraphElement('suggestion-title', suggestion.suggestion_title));
  suggestionDetailsHeaderElement.appendChild(createRatingContainer(suggestion.likes_count));

  const isMemberSuggestion: boolean = globalHangoutState.data?.hangoutMemberId === suggestion.hangout_member_id;
  if (isLeader || isMemberSuggestion) {
    suggestionDetailsHeaderElement.appendChild(createDropdownMenuElement(isMemberSuggestion));
  };

  suggestionDetailsElement.appendChild(suggestionDetailsHeaderElement);
  suggestionDetailsElement.appendChild(createSuggestionDetailsContainer(suggestion));
  suggestionDetailsElement.appendChild(createBtnContainer(isVotedFor));

  return suggestionDetailsElement;
};

function createRatingContainer(likesCount: number): HTMLDivElement {
  const ratingContainer: HTMLDivElement = createDivElement('rating-container');

  const likeSuggestionBtn: HTMLButtonElement = createBtnElement('like-suggestion-btn', null);
  likeSuggestionBtn.appendChild(createLikeIcon());
  likeSuggestionBtn.appendChild(createDivElement('like-spinner'));

  ratingContainer.appendChild(createSpanElement('suggestion-likes-count', `${likesCount}`));
  ratingContainer.appendChild(likeSuggestionBtn);

  return ratingContainer;
};

function createDropdownMenuElement(isMemberSuggestion: boolean): HTMLDivElement {
  const dropdownMenuElement: HTMLDivElement = createDivElement('dropdown-menu');

  const dropdownMenuBtn: HTMLButtonElement = createBtnElement('dropdown-menu-btn', null);
  dropdownMenuBtn.appendChild(createDropdownIcon());

  const dropdownMenuList: HTMLDivElement = createDivElement('dropdown-menu-list');
  isMemberSuggestion && dropdownMenuList.appendChild(createBtnElement('edit-btn', 'Edit'));
  dropdownMenuList.appendChild(createBtnElement('delete-btn', 'Delete'));

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

  return suggestionDetailsContainer;
};

function createBtnContainer(isVotedFor: boolean): HTMLDivElement {
  const btnContainer: HTMLDivElement = createDivElement('btn-container');
  btnContainer.appendChild(createBtnElement('view-suggestion-btn', 'View details'));
  btnContainer.appendChild(createBtnElement('add-vote-btn', isVotedFor ? 'Remove vote' : 'Add vote'));

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

  const firstDropdownPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  firstDropdownPathElement.setAttribute('d', 'M330 70C330 103.137 303.137 130 270 130C236.863 130 210 103.137 210 70C210 36.8629 236.863 10 270 10C303.137 10 330 36.8629 330 70Z');

  const secondDropdownPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  secondDropdownPathElement.setAttribute('d', 'M330 270C330 303.137 303.137 330 270 330C236.863 330 210 303.137 210 270C210 236.863 236.863 210 270 210C303.137 210 330 236.863 330 270Z');

  const thirdDropdownPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  thirdDropdownPathElement.setAttribute('d', 'M330 470C330 503.137 303.137 530 270 530C236.863 530 210 503.137 210 470C210 436.863 236.863 410 270 410C303.137 410 330 436.863 330 470Z');

  dropdownSvgElement.appendChild(firstDropdownPathElement);
  dropdownSvgElement.appendChild(secondDropdownPathElement);
  dropdownSvgElement.appendChild(thirdDropdownPathElement);

  return dropdownSvgElement;
};