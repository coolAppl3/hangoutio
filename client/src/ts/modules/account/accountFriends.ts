import { handleAuthSessionExpired } from "../global/authUtils";
import { ConfirmModal } from "../global/ConfirmModal";
import { debounce } from "../global/debounce";
import { createDivElement, createParagraphElement } from "../global/domUtils";
import { AsyncErrorData, getAsyncErrorData } from "../global/errorUtils";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { acceptFriendRequestService, rejectFriendRequestService, removeFriendService } from "../services/accountServices";
import { Friend, FriendRequest } from "./accountTypes";
import { createFriendElement, createFriendRequestElement } from "./accountUtils";
import { accountState } from "./initAccount";

type SelectTab = 'friends-list' | 'pending-requests' | 'add-friends-form';

interface AccountFriendsState {
  selectedTab: SelectTab,
  renderLimit: number | null,

  filteredFriends: Friend[],
};

const accountFriendsState: AccountFriendsState = {
  selectedTab: 'friends-list',
  renderLimit: 6,

  filteredFriends: [],
};

const friendsElement: HTMLDivElement | null = document.querySelector('#friends');

const friendsCountSpan: HTMLSpanElement | null = document.querySelector('#friends-count-span');
const pendingRequestsCountSpan: HTMLSpanElement | null = document.querySelector('#pending-requests-count-span');

const friendsContainer: HTMLDivElement | null = document.querySelector('#friends-container');
const friendsSearchInput: HTMLInputElement | null = document.querySelector('#friends-search-input');
const showAllFriendsBtn: HTMLButtonElement | null = document.querySelector('#show-all-friends-btn');

const pendingRequestsElement: HTMLDivElement | null = document.querySelector('#pending-requests');


export function initAccountFriends(): void {
  if (!accountState.data) {
    popup('Failed to load friends list.', 'error');
    return;
  };

  accountFriendsState.filteredFriends = [...accountState.data.friends];

  loadEventListeners();
  renderAccountFriends();
};

function renderAccountFriends(): void {
  renderCountSpans();
  renderFriendsContainer();
  renderPendingRequests();
};

function loadEventListeners(): void {
  friendsElement?.addEventListener('click', handleFriendsElementClicks);
  friendsSearchInput?.addEventListener('input', debounceSearchFriends);
};

function renderCountSpans(): void {
  if (!accountState.data) {
    return;
  };

  if (!friendsCountSpan || !pendingRequestsCountSpan) {
    return;
  };

  const { friends, friendRequests } = accountState.data;

  friendsCountSpan.textContent = `${friends.length}`;
  pendingRequestsCountSpan.textContent = `${friendRequests.length}`;
};

function renderFriendsContainer(): void {
  if (!friendsContainer) {
    return;
  };

  const innerFriendsContainer: HTMLDivElement = createDivElement(null, 'friends-container-inner');

  if (accountFriendsState.filteredFriends.length === 0) {
    innerFriendsContainer.appendChild(createParagraphElement('no-friends', 'No friends found.'));
  };

  for (let i = 0; i < (accountFriendsState.renderLimit || accountFriendsState.filteredFriends.length); i++) {
    const friend: Friend | undefined = accountFriendsState.filteredFriends[i];

    if (!friend) {
      continue;
    };

    innerFriendsContainer.appendChild(createFriendElement(friend));
  };

  friendsContainer.firstElementChild?.remove();
  friendsContainer.appendChild(innerFriendsContainer);

  if (accountFriendsState.renderLimit && accountFriendsState.renderLimit < accountFriendsState.filteredFriends.length) {
    showAllFriendsBtn?.classList.remove('hidden');
  };
};

function renderPendingRequests(): void {
  if (!accountState.data || !pendingRequestsElement) {
    return;
  };

  const pendingRequestsContainer: HTMLDivElement = createDivElement(null, 'pending-requests-container');

  if (accountState.data.friendRequests.length === 0) {
    pendingRequestsContainer.appendChild(createParagraphElement('no-requests', 'No pending requests.'));
  };

  for (const request of accountState.data.friendRequests) {
    pendingRequestsContainer.appendChild(createFriendRequestElement(request));
  };

  pendingRequestsElement.firstElementChild?.remove();
  pendingRequestsElement.appendChild(pendingRequestsContainer);
};

async function handleFriendsElementClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.classList.contains('friends-tab-btn')) {
    navigateFriendsTab(e.target);
    return;
  };

  if (e.target.id === 'show-all-friends-btn') {
    accountFriendsState.renderLimit = null;
    e.target.classList.add('hidden');

    renderFriendsContainer();
    return;
  };

  if (e.target.classList.contains('remove-friend-btn')) {
    confirmFriendDeletion(e.target);
    return;
  };

  if (e.target.classList.contains('friend-request-btn')) {
    await handleFriendRequestAction(e.target);
    return;
  };
};

async function removeFriend(friendshipId: number): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await removeFriendService(friendshipId);

    accountState.data.friends = accountState.data.friends.filter((friend: Friend) => friend.friendship_id !== friendshipId);
    accountFriendsState.filteredFriends = accountFriendsState.filteredFriends.filter((friend: Friend) => friend.friendship_id !== friendshipId);

    renderFriendsContainer();
    renderCountSpans();

    popup('Friend removed.', 'success');
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

    if (status === 404) {
      renderFriendsContainer();
      return;
    };

    if (status === 401) {
      handleAuthSessionExpired();
    };
  };
};

async function acceptFriendRequest(friendRequest: FriendRequest, friendRequestElement: HTMLDivElement): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    const { friendship_id, friendship_timestamp } = (await acceptFriendRequestService({ friendRequestId: friendRequest.request_id })).data;

    accountState.data.friendRequests = accountState.data.friendRequests.filter((request: FriendRequest) => request.request_id !== friendRequest.request_id);
    accountState.data.friends.push({
      friendship_id,
      friend_username: friendRequest.requester_username,
      friend_display_name: friendRequest.requester_display_name,
      friendship_timestamp,
    });

    accountFriendsState.filteredFriends = [...accountState.data.friends];
    renderFriendsContainer();

    slideAndRemoveRequestElement(friendRequestElement);
    renderCountSpans();

    popup('Request accepted.', 'success');
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

    if (status === 404 || status === 409) {
      slideAndRemoveRequestElement(friendRequestElement);
      return;
    };

    if (status === 401) {
      handleAuthSessionExpired();
    };
  };
};

async function rejectFriendRequest(friendRequest: FriendRequest, friendRequestElement: HTMLDivElement): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await rejectFriendRequestService(friendRequest.request_id);

    accountState.data.friendRequests = accountState.data.friendRequests.filter((request: FriendRequest) => request.request_id !== friendRequest.request_id);

    slideAndRemoveRequestElement(friendRequestElement);
    renderFriendsContainer();
    renderCountSpans();

    popup('Request rejected.', 'success');
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

function navigateFriendsTab(clickedBtn: HTMLButtonElement): void {
  const selectedTab: string | null = clickedBtn.getAttribute('data-selectedTab');

  if (selectedTab !== 'friends-list' && selectedTab !== 'pending-requests' && selectedTab !== 'add-friends-form') {
    return;
  };

  if (selectedTab === accountFriendsState.selectedTab) {
    return;
  };

  document.querySelector(`#${accountFriendsState.selectedTab}`)?.classList.add('hidden');
  document.querySelector(`#${selectedTab}`)?.classList.remove('hidden');

  for (const btn of document.querySelectorAll('.friends-tab-btn')) {
    if (btn.getAttribute('data-selectedTab') === selectedTab) {
      btn.classList.add('selected');
      continue;
    };

    btn.classList.remove('selected');
  };

  accountFriendsState.selectedTab = selectedTab;
};

const debounceSearchFriends = debounce(searchFriends, 300);

function searchFriends(): void {
  if (!accountState.data || !friendsSearchInput) {
    return;
  };

  const searchQuery: string = friendsSearchInput.value;
  accountFriendsState.filteredFriends = accountState.data.friends.filter((friend: Friend) => friend.friend_display_name.toLowerCase().includes(searchQuery.toLowerCase()));

  renderFriendsContainer();
};

function confirmFriendDeletion(clickedBtn: HTMLButtonElement): void {
  const friendshipId: string | undefined | null = clickedBtn.parentElement?.getAttribute('data-friendshipId');

  if (!friendshipId || !Number.isInteger(+friendshipId)) {
    return;
  };

  const friend: Friend | undefined = accountState.data?.friends.find((friend: Friend) => friend.friendship_id === +friendshipId);

  if (!friend) {
    renderFriendsContainer();
    popup('Friend not found.', 'error');

    return;
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: null,
    description: `Are you sure you want to remove ${friend.friend_display_name} from your friends list?`,
    confirmBtnTitle: 'Remove friend',
    cancelBtnTitle: 'Cancel',
    extraBtnTitle: null,
    isDangerousAction: true,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      ConfirmModal.remove();
      await removeFriend(+friendshipId);

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};

async function handleFriendRequestAction(clickedBtn: HTMLButtonElement): Promise<void> {
  if (!accountState.data) {
    return;
  };

  const friendRequestElement: HTMLElement | null | undefined = clickedBtn.parentElement?.parentElement;

  if (!friendRequestElement || !(friendRequestElement instanceof HTMLDivElement)) {
    return;
  };

  const friendRequestId: string | null = friendRequestElement.getAttribute('data-friendRequestId');

  if (!friendRequestId || !Number.isInteger(+friendRequestId)) {
    return;
  };

  const friendRequest: FriendRequest | undefined = accountState.data.friendRequests.find((request: FriendRequest) => request.request_id === +friendRequestId);
  const isRejectionAction: boolean = clickedBtn.classList.contains('reject-request-btn');

  if (!friendRequest) {
    popup(isRejectionAction ? 'Request rejected.' : 'Request not found.', 'error');
    slideAndRemoveRequestElement(friendRequestElement);

    return;
  };

  if (isRejectionAction) {
    await rejectFriendRequest(friendRequest, friendRequestElement);
    return;
  };

  await acceptFriendRequest(friendRequest, friendRequestElement);
};

function slideAndRemoveRequestElement(friendRequestElement: HTMLDivElement): void {
  friendRequestElement.classList.add('remove');
  setTimeout(() => friendRequestElement.remove(), 250);

  if (accountState.data?.friendRequests.length === 0) {
    renderPendingRequests();
  };
};