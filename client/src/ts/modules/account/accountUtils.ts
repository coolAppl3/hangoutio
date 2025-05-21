import { getDateAndTimeString, getFullDateSTring } from "../global/dateTimeUtils";
import { createAnchorElement, createBtnElement, createDivElement, createParagraphElement, createSvgElement } from "../global/domUtils";
import { InfoModal } from "../global/InfoModal";
import { removeSignInCookies } from "../global/signOut";
import { getHangoutStageTitle } from "../hangout/dashboard/hangoutDashboardUtils";
import { Friend, FriendRequest, Hangout } from "./accountTypes";

export function removeLoadingSkeleton(): void {
  document.querySelector('#loading-skeleton')?.remove();
  document.querySelectorAll('section').forEach((section: HTMLElement) => section.classList.remove('hidden'));

  document.documentElement.scrollTop = 0;
};

export function handleAccountLocked(): void {
  removeSignInCookies();

  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Account locked.',
    description: 'Your account was locked due to too entering the incorrect password too many times.',
    btnTitle: 'Okay',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'home';
    };
  });
};

export function handleOngoingRequest(errResData: unknown, ongoingRequestTitle: string): void {
  if (typeof errResData !== 'object' || errResData === null) {
    return;
  };

  if (!('expiryTimestamp' in errResData) || typeof errResData.expiryTimestamp !== 'number') {
    return;
  };

  if (!Number.isInteger(errResData.expiryTimestamp)) {
    return;
  };

  const requestExpiryDate: string = getDateAndTimeString(errResData.expiryTimestamp);

  InfoModal.display({
    title: `Ongoing ${ongoingRequestTitle} request found.`,
    description: `It will expire on ${requestExpiryDate}.`,
    btnTitle: 'Okay',
  }, { simple: true });
};

export function handleOngoingOpposingRequest(ongoingRequestTitle: string,): void {
  InfoModal.display({
    title: `Ongoing ${ongoingRequestTitle} request found.`,
    description: `You have to either complete or abort the ${ongoingRequestTitle} request before being able to continue.`,
    btnTitle: 'Okay',
  }, { simple: true });
};

export function handleRequestSuspended(errResData: unknown, ongoingRequestTitle: 'email update' | 'account deletion'): void {
  if (typeof errResData !== 'object' || errResData === null) {
    return;
  };

  if (!('expiryTimestamp' in errResData) || typeof errResData.expiryTimestamp !== 'number') {
    return;
  };

  if (!Number.isInteger(errResData.expiryTimestamp)) {
    return;
  };

  InfoModal.display({
    title: `Request suspended.`,
    description: `Your ${ongoingRequestTitle} request has been suspended due to too many failed attempts\nYou can start a new one after ${errResData.expiryTimestamp}.`,
    btnTitle: 'Okay',
  }, { simple: true });
};

// --- --- ---

export function createFriendElement(friend: Friend): HTMLDivElement {
  const friendElement: HTMLDivElement = createDivElement('friend');
  friendElement.setAttribute('data-friendshipId', `${friend.friendship_id}`);


  friendElement.appendChild(createInnerFriendsContainer(friend));
  friendElement.appendChild(createRemoveFriendBtn());

  return friendElement;
};

function createInnerFriendsContainer(friend: Friend): HTMLDivElement {
  const innerContainer: HTMLDivElement = createDivElement(null);

  innerContainer.appendChild(createParagraphElement(null, friend.friend_display_name));
  innerContainer.appendChild(createParagraphElement(null, `@${friend.friend_username}`));
  innerContainer.appendChild(createParagraphElement(null, `Since: ${getFullDateSTring(friend.friendship_timestamp)}`));

  return innerContainer;
};

function createRemoveFriendBtn(): HTMLButtonElement {
  const removeFriendBtn: HTMLButtonElement = createBtnElement('remove-friend-btn', null);

  removeFriendBtn.setAttribute('title', 'Remove friend');
  removeFriendBtn.setAttribute('aria-label', 'Remove friend');

  removeFriendBtn.appendChild(createRemoveFriendIcon());
  return removeFriendBtn;
};

function createRemoveFriendIcon(): SVGSVGElement {
  const removeFriendSvg: SVGSVGElement = createSvgElement(601, 600);

  const firstPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  firstPathElement.setAttribute('d', 'M500.066 425C508.35 425 515.066 431.716 515.066 440C515.066 448.284 508.35 455 500.066 455H390.066C381.782 455 375.066 448.284 375.066 440C375.066 431.716 381.782 425 390.066 425H500.066Z');

  const secondPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  secondPathElement.setAttribute('fill-rule', 'evenodd');
  secondPathElement.setAttribute('clip-rule', 'evenodd');
  secondPathElement.setAttribute('d', 'M445.066 310C516.863 310 575.066 368.203 575.066 440C575.066 511.797 516.863 570 445.066 570C399.255 570 358.98 546.303 335.826 510.5H45.066C34.0203 510.5 24.9559 501.518 26.0972 490.531C36.081 394.43 117.323 319.5 216.066 319.5H369.066C377.086 319.5 384.99 319.997 392.75 320.957C392.623 321.013 392.497 321.07 392.371 321.126C408.478 313.975 426.308 310 445.066 310ZM445.066 340C389.838 340 345.066 384.772 345.066 440C345.066 495.228 389.838 540 445.066 540C500.294 540 545.066 495.228 545.066 440C545.066 384.772 500.294 340 445.066 340Z');

  const thirdPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  thirdPathElement.setAttribute('d', 'M292.066 29C361.101 29.0002 417.066 84.9645 417.066 154C417.066 223.035 361.101 279 292.066 279C223.03 279 167.066 223.036 167.066 154C167.066 84.9644 223.03 29.0001 292.066 29Z');

  removeFriendSvg.appendChild(firstPathElement);
  removeFriendSvg.appendChild(secondPathElement);
  removeFriendSvg.appendChild(thirdPathElement);

  return removeFriendSvg;
};

export function createFriendRequestElement(friendRequest: FriendRequest): HTMLDivElement {
  const friendRequestElement: HTMLDivElement = createDivElement('friend-request');
  friendRequestElement.setAttribute('data-friendRequestId', `${friendRequest.request_id}`);

  friendRequestElement.appendChild(createInnerFriendRequestContainer(friendRequest));
  friendRequestElement.appendChild(createFriendRequestBtnContainer());

  return friendRequestElement;
};

function createInnerFriendRequestContainer(friendRequest: FriendRequest): HTMLDivElement {
  const innerContainer: HTMLDivElement = createDivElement(null);

  innerContainer.appendChild(createParagraphElement(null, friendRequest.requester_display_name));
  innerContainer.appendChild(createParagraphElement(null, `@${friendRequest.requester_username}`));
  innerContainer.appendChild(createParagraphElement(null, `Requested on ${getFullDateSTring(friendRequest.request_timestamp)}`));

  return innerContainer;
};

function createFriendRequestBtnContainer(): HTMLDivElement {
  const btnContainer: HTMLDivElement = createDivElement('btn-container');

  btnContainer.appendChild(createBtnElement('reject-request-btn friend-request-btn', 'Reject'));
  btnContainer.appendChild(createBtnElement('accept-request-btn friend-request-btn', 'Accept'));

  return btnContainer;
};

// --- --- ---

export function createHangoutElement(hangout: Hangout): HTMLDivElement {
  const hangoutElement: HTMLDivElement = createDivElement('hangout');
  hangoutElement.setAttribute('data-hangoutId', hangout.hangout_id);

  hangoutElement.appendChild(createHangoutDetailsElement(hangout));
  hangoutElement.appendChild(createAnchorElement('view-hangout-btn', 'View', `hangout?id=${hangout.hangout_id}`, true));
  hangoutElement.appendChild(createLeaveHangoutBtn());
  return hangoutElement;
};

function createHangoutDetailsElement(hangout: Hangout): HTMLDivElement {
  const hangoutDetailsElement: HTMLDivElement = createDivElement('hangout-details');

  hangoutDetailsElement.appendChild(createParagraphElement(null, hangout.hangout_title));
  hangoutDetailsElement.appendChild(createParagraphElement(null, `Current stage: ${getHangoutStageTitle(hangout.current_stage)}`));
  hangoutDetailsElement.appendChild(createParagraphElement(null, `Created on: ${getFullDateSTring(hangout.created_on_timestamp)}`));

  return hangoutDetailsElement;
};

function createLeaveHangoutBtn(): HTMLButtonElement {
  const leaveHangoutBtn: HTMLButtonElement = createBtnElement('leave-hangout-btn', null);

  leaveHangoutBtn.setAttribute('title', 'Leave hangout');
  leaveHangoutBtn.setAttribute('aria-label', 'Leave hangout');

  leaveHangoutBtn.appendChild(createLeaveHangoutIcon());
  return leaveHangoutBtn;
};

function createLeaveHangoutIcon(): SVGSVGElement {
  const leaveHangoutSvg: SVGSVGElement = createSvgElement(500, 500);

  const pathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathElement.setAttribute('fill-rule', 'evenodd');
  pathElement.setAttribute('clip-rule', 'evenodd');
  pathElement.setAttribute('d', 'M450 250C450 360.457 360.457 450 250 450C139.543 450 50 360.457 50 250C50 139.543 139.543 50 250 50C360.457 50 450 139.543 450 250ZM410 250C410 338.366 338.366 410 250 410C213.236 410 179.368 397.601 152.35 376.756L376.756 152.35C397.601 179.368 410 213.236 410 250ZM123.963 348.575L348.575 123.963C321.406 102.685 287.185 90 250 90C161.634 90 90 161.634 90 250C90 287.185 102.685 321.406 123.963 348.575Z');

  leaveHangoutSvg.appendChild(pathElement);
  return leaveHangoutSvg;
};