import { debounce } from "../global/debounce";
import { createDivElement, createParagraphElement } from "../global/domUtils";
import popup from "../global/popup";
import { Friend } from "./accountTypes";
import { createFriendElement } from "./accountUtils";
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

export function initAccountFriends(): void {
  if (!accountState.data) {
    popup('Failed to load friends list.', 'error');
    return;
  };

  accountFriendsState.filteredFriends = [...accountState.data.friends];

  LoadEventListeners();
  renderAccountFriends();
};

function renderAccountFriends(): void {
  renderCountSpans();
  renderFriendsContainer();
};

function LoadEventListeners(): void {
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

function handleFriendsElementClicks(e: MouseEvent): void {
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