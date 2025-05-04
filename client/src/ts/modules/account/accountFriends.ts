import { handleAuthSessionExpired } from "../global/authUtils";
import { ConfirmModal } from "../global/ConfirmModal";
import { debounce } from "../global/debounce";
import { createDivElement, createParagraphElement } from "../global/domUtils";
import { AsyncErrorData, getAsyncErrorData } from "../global/errorUtils";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { removeFriendService } from "../services/accountServices";
import { Friend } from "./accountTypes";
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