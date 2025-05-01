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
  renderFriendsContainer();
};

function LoadEventListeners(): void {
  friendsElement?.addEventListener('click', handleFriendsElementClicks);
  friendsSearchInput?.addEventListener('input', debounceSearchFriends);
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

  if (e.target.id === 'show-all-friends-btn') {
    accountFriendsState.renderLimit = null;
    e.target.classList.add('hidden');

    renderFriendsContainer();
    return;
  };
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