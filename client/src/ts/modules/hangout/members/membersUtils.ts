import { createBtnElement, createDivElement, createParagraphElement, createSvgElement } from "../../global/domUtils";
import { globalHangoutState } from "../globalHangoutState";
import { HangoutMember } from "../hangoutTypes";

export function createMemberElement(member: HangoutMember, renderingForLeader: boolean, renderingForGuest: boolean): HTMLDivElement {
  const memberElement: HTMLDivElement = createDivElement('member');
  memberElement.setAttribute('data-memberId', `${member.hangout_member_id}`);

  member.is_leader && memberElement.classList.add('leader');
  member.hangout_member_id === globalHangoutState.data?.hangoutMemberId && memberElement.classList.add('user');

  memberElement.appendChild(createMemberHeader(member, renderingForLeader, renderingForGuest));
  memberElement.appendChild(createParagraphElement('member-username', `@${member.username}`));
  memberElement.appendChild(createParagraphElement('member-type', member.user_type === 'account' ? 'Registered user' : 'Guest user'));

  if (member.is_leader) {
    const leaderIconDiv: HTMLDivElement = createDivElement('leader-icon');
    leaderIconDiv.setAttribute('title', 'Hangout leader');
    leaderIconDiv.setAttribute('aria-label', 'Hangout leader');

    leaderIconDiv.appendChild(createLeaderIcon());
    memberElement.appendChild(leaderIconDiv);
  };

  return memberElement;
};

function createMemberHeader(member: HangoutMember, renderingForLeader: boolean, renderingForGuest: boolean): HTMLDivElement {
  const memberHeader: HTMLDivElement = createDivElement('member-header');
  memberHeader.appendChild(createParagraphElement('display-name', member.display_name));

  const isUser: boolean = member.hangout_member_id === globalHangoutState.data?.hangoutMemberId;
  const isGuestUser: boolean = member.user_type === 'guest';

  if (renderingForGuest && !renderingForLeader) {
    return memberHeader;
  };

  if (renderingForLeader) {
    memberHeader.appendChild(createMemberDropdownMenu(member, renderingForLeader, isUser, isGuestUser));
    return memberHeader;
  };

  if (isUser || isGuestUser || member.is_friend) {
    return memberHeader;
  };

  memberHeader.appendChild(createMemberDropdownMenu(member, renderingForLeader, isUser, isGuestUser));
  return memberHeader;
};

function createMemberDropdownMenu(member: HangoutMember, renderingForLeader: boolean, isUser: boolean, isGuestUser: boolean): HTMLDivElement {
  const dropdownMenu: HTMLDivElement = createDivElement('dropdown-menu');

  const dropdownMenuButton: HTMLButtonElement = createBtnElement('dropdown-menu-btn', null);
  dropdownMenuButton.setAttribute('title', 'Expand member options');
  dropdownMenuButton.setAttribute('aria-label', 'Expand member options');
  dropdownMenuButton.appendChild(createDropdownIcon());

  const dropdownMenuList: HTMLDivElement = createDivElement('dropdown-menu-list');

  if (!isUser && !isGuestUser && !member.is_friend) {
    dropdownMenuList.appendChild(createBtnElement('add-friend-btn', 'Send friend request'));
  };

  if (!renderingForLeader) {
    dropdownMenu.appendChild(dropdownMenuButton);
    dropdownMenu.appendChild(dropdownMenuList);

    return dropdownMenu;
  };

  if (isUser) {
    dropdownMenuList.appendChild(createBtnElement('relinquish-leadership-btn', 'Relinquish leadership'));

  } else {
    globalHangoutState.data?.hangoutDetails.is_concluded || dropdownMenuList.appendChild(createBtnElement('transfer-leadership-btn', 'Transfer leadership'));
    dropdownMenuList.appendChild(createBtnElement('kick-member-btn', 'Kick member'));
  };

  dropdownMenu.appendChild(dropdownMenuButton);
  dropdownMenu.appendChild(dropdownMenuList);

  return dropdownMenu;
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

function createLeaderIcon(): SVGSVGElement {
  const leaderSvgElement: SVGSVGElement = createSvgElement(540, 540);

  const pathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathElement.setAttribute('d', 'M286.748 168.173C297.072 162.086 304 150.852 304 138C304 118.67 288.33 103 269 103C249.67 103 234 118.67 234 138C234 151.04 241.131 162.415 251.707 168.436L196.5 273.376C193.977 278.174 188.09 280.087 183.227 277.689L74.1836 223.909C76.623 219.135 78 213.728 78 208C78 188.67 62.3301 173 43 173C23.6699 173 8 188.67 8 208C8 227.33 23.6699 243 43 243C44.2012 243 45.3887 242.939 46.5586 242.821L64.8477 419.064C65.9062 429.256 74.4941 437 84.7402 437H453.854C464.1 437 472.688 429.256 473.746 419.064L492.039 242.778C493.34 242.925 494.66 243 496 243C515.33 243 531 227.33 531 208C531 188.67 515.33 173 496 173C476.67 173 461 188.67 461 208C461 213.664 462.346 219.015 464.734 223.748L355.367 277.689C350.504 280.087 344.617 278.174 342.094 273.376L286.748 168.173Z');

  leaderSvgElement.appendChild(pathElement);
  return leaderSvgElement;
};