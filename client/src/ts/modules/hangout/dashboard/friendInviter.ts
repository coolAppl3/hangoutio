import { Friend } from "../../account/accountTypes";
import { ACCOUNT_FRIENDS_FETCH_BATCH_SIZE } from "../../global/clientConstants";
import { AsyncErrorData, getAsyncErrorData } from "../../global/errorUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { inviteFriendToHangoutService, loadMoreFriendsService } from "../../services/accountServices";
import { globalHangoutState } from "../globalHangoutState";
import { handleAuthSessionExpired } from "../../global/authUtils";
import { createBtnElement, createDivElement, createParagraphElement, createSvgElement } from "../../global/domUtils";

interface FriendInviterState {
  isLoaded: boolean,
  friends: Friend[],

  currentOffset: number,
  offsetIncrement: number,

  allFriendsFetched: boolean,
};

const friendInviterState: FriendInviterState = {
  isLoaded: false,
  friends: [],

  currentOffset: 0,
  offsetIncrement: ACCOUNT_FRIENDS_FETCH_BATCH_SIZE,

  allFriendsFetched: false,
};

const friendInviterElement: HTMLDivElement | null = document.querySelector('#friend-inviter');
const friendInviterList: HTMLDivElement | null = document.querySelector('#friend-inviter-list');

const loadMoreFriendsBtn: HTMLButtonElement | null = document.querySelector('#load-more-friends-btn');

export async function initFriendInviter(): Promise<void> {
  if (friendInviterState.isLoaded) {
    displayFriendInviter();
    return;
  };

  loadEventListener();

  await loadMoreFriends();
  friendInviterState.isLoaded = true;

  displayFriendInviter();
};

function loadEventListener(): void {
  friendInviterElement?.addEventListener('click', handleFriendInviterClicks);
};

async function loadMoreFriends(): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (friendInviterState.allFriendsFetched) {
    popup('All friends loaded.', 'success');
    LoadingModal.remove();

    return;
  };

  try {
    const friends: Friend[] = (await loadMoreFriendsService(friendInviterState.currentOffset)).data.friends;

    if (friends.length === 0) {
      friendInviterState.allFriendsFetched = true;
      loadMoreFriendsBtn?.classList.add('hidden');

      popup(`You haven't added any friends yet.`, 'error');
      LoadingModal.remove();

      return;
    };

    if (friends.length < friendInviterState.offsetIncrement) {
      friendInviterState.allFriendsFetched = true;
      loadMoreFriendsBtn?.classList.add('hidden');

      popup('All friends loaded.', 'success');
    };

    friendInviterState.currentOffset += friendInviterState.offsetIncrement;

    insertFriends(friends);
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 401) {
      handleAuthSessionExpired();
    };
  };
};

async function inviteFriendToHangout(friendshipId: number, friendUsername: string, friendElement: HTMLDivElement): Promise<void> {
  friendElement.classList.add('sending');

  if (!globalHangoutState.data) {
    friendElement.classList.remove('sending');
    return;
  };

  if (globalHangoutState.data.hangoutMembersUsernameSet.has(friendUsername)) {
    friendElement.remove();
    popup('User has already joined the hangout.', 'success');

    return;
  };

  try {
    await inviteFriendToHangoutService({ friendshipId, hangoutId: globalHangoutState.data.hangoutId });

    displayFriendElementInvitation(friendElement);
    popup('Invitation sent.', 'success');

  } catch (err: unknown) {
    console.log(err);
    friendElement.classList.remove('sending');

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

    if (status === 409 && errReason === 'alreadySent') {
      popup(errMessage, 'success');
      displayFriendElementInvitation(friendElement);

      return;
    };

    if (status === 409 && errReason === 'alreadyInHangout') {
      popup(errMessage, 'success');
      friendElement.remove();

      return;
    };

    popup(errMessage, 'error');

    if (status === 409 && errReason === 'notInHangout') {
      setTimeout(() => window.location.reload(), 1000);
      return;
    };

    if (status === 404) {
      if (errReason === 'friendNotFound') {
        friendElement.remove();
        return;
      };

      setTimeout(() => window.location.reload(), 1000);
      return;
    };

    if (status === 401) {
      handleAuthSessionExpired();
    };
  };
};

function insertFriends(friends: Friend[]): void {
  if (!globalHangoutState.data || !friendInviterList) {
    return;
  };

  const fragment: DocumentFragment = new DocumentFragment();

  for (const friend of friends) {
    const alreadyInHangout: boolean = globalHangoutState.data.hangoutMembersUsernameSet.has(friend.friend_username);
    fragment.appendChild(createFriendElement(friend, alreadyInHangout));
  };

  friendInviterList.appendChild(fragment);
};

async function handleFriendInviterClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'close-friend-inviter') {
    closeFriendInviter();
    return;
  };

  if (e.target.id === 'load-more-friends-btn') {
    await loadMoreFriends();
    return;
  };

  if (e.target.className === 'invite-friend-btn') {
    const friendElement: HTMLElement | null = e.target.parentElement;

    if (!(friendElement instanceof HTMLDivElement)) {
      popup('Something went wrong.', 'error');
      return;
    };

    const friendUsername: string | null = friendElement.getAttribute('data-friendUsername');
    const friendshipId: string | null = friendElement.getAttribute('data-friendshipId');

    if (!friendUsername || !friendshipId || !Number.isInteger(+friendshipId)) {
      popup('Something went wrong.', 'error');
      return;
    };

    if (globalHangoutState.data?.hangoutMembersUsernameSet.has(friendUsername)) {
      popup('This friend is already in the hangout.', 'success');
      return;
    };

    await inviteFriendToHangout(+friendshipId, friendUsername, friendElement);
  };
};

function displayFriendInviter(): void {
  if (!friendInviterElement) {
    return;
  };

  friendInviterElement.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      friendInviterElement.classList.add('revealed');
    });
  });
};

function closeFriendInviter(): void {
  if (!friendInviterElement) {
    return;
  };

  friendInviterElement.classList.remove('revealed');
  setTimeout(() => {
    friendInviterList?.parentElement && (friendInviterList.parentElement.scrollTop = 0);
    friendInviterElement.style.display = 'none';
  }, 150);
};

function displayFriendElementInvitation(friendElement: HTMLDivElement): void {
  const inviteFriendBtn: HTMLButtonElement | null = friendElement.querySelector('.invite-friend-btn');

  if (!inviteFriendBtn) {
    return;
  };

  friendElement.classList.remove('sending');
  friendElement.classList.add('sent');

  inviteFriendBtn.firstElementChild?.replaceWith(createInvitedIcon());
};

// --- --- ---

export function createFriendElement(friend: Friend, alreadyInHangout: boolean): HTMLDivElement {
  const friendElement: HTMLDivElement = createDivElement('friend');

  friendElement.setAttribute('data-friendshipId', `${friend.friendship_id}`);
  friendElement.setAttribute('data-friendUsername', `${friend.friend_username}`);

  friendElement.appendChild(createInnerFriendsContainer(friend));

  if (!alreadyInHangout) {
    friendElement.appendChild(createInviteFriendBtn());
    friendElement.appendChild(createDivElement('spinner'));
  };

  return friendElement;
};

function createInnerFriendsContainer(friend: Friend): HTMLDivElement {
  const innerContainer: HTMLDivElement = createDivElement(null);

  innerContainer.appendChild(createParagraphElement(null, friend.friend_display_name));
  innerContainer.appendChild(createParagraphElement(null, `@${friend.friend_username}`));

  return innerContainer;
};

function createInviteFriendBtn(): HTMLButtonElement {
  const removeFriendBtn: HTMLButtonElement = createBtnElement('invite-friend-btn', null);

  removeFriendBtn.setAttribute('title', 'Invite friend');
  removeFriendBtn.setAttribute('aria-label', 'Invite friend');

  removeFriendBtn.appendChild(createRemoveFriendIcon());
  return removeFriendBtn;
};

function createRemoveFriendIcon(): SVGSVGElement {
  const removeFriendSvg: SVGSVGElement = createSvgElement(500, 500);

  const firstPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  firstPathElement.setAttribute('d', 'M50 250C50 233.431 63.4315 220 80 220H420C436.569 220 450 233.431 450 250C450 266.569 436.569 280 420 280H80C63.4315 280 50 266.569 50 250Z');

  const secondPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  secondPathElement.setAttribute('d', 'M250 50C266.569 50 280 63.4315 280 80L280 420C280 436.569 266.569 450 250 450C233.431 450 220 436.569 220 420L220 80C220 63.4315 233.431 50 250 50Z');

  removeFriendSvg.appendChild(firstPathElement);
  removeFriendSvg.appendChild(secondPathElement);

  return removeFriendSvg;
};

function createInvitedIcon(): SVGSVGElement {
  const invitedIcon: SVGSVGElement = createSvgElement(601, 601);

  const firstPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  firstPathElement.setAttribute('d', 'M106.645 335.421C87.1184 315.895 87.1184 284.237 106.645 264.711C126.171 245.184 157.829 245.184 177.355 264.711L318.777 406.132L283.421 441.487C263.895 461.014 232.237 461.014 212.711 441.487L106.645 335.421Z');

  const secondPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  secondPathElement.setAttribute('d', 'M177.355 406.132L424.843 158.645C444.369 139.118 476.027 139.118 495.553 158.645C515.08 178.171 515.08 209.829 495.553 229.355L283.421 441.487C263.895 461.014 232.237 461.014 212.711 441.487L177.355 406.132Z');

  invitedIcon.appendChild(firstPathElement);
  invitedIcon.appendChild(secondPathElement);

  return invitedIcon;
};