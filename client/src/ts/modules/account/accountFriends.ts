import { createDivElement, createParagraphElement } from "../global/domUtils";
import { Friend } from "./accountTypes";
import { createFriendElement } from "./accountUtils";
import { accountState } from "./initAccount";

type SelectTab = 'friends-list' | 'pending-requests' | 'add-friends-form';

interface AccountFriendsState {
  selectedTab: SelectTab,
  renderLimit: number | null,
};

const accountFriendsState: AccountFriendsState = {
  selectedTab: 'friends-list',
  renderLimit: 6,
};


const friendsElement: HTMLDivElement | null = document.querySelector('#friends');

const friendsContainer: HTMLDivElement | null = document.querySelector('#friends-container');
const friendsSearchInput: HTMLInputElement | null = document.querySelector('#friends-search-input');
const showAllFriendsBtn: HTMLButtonElement | null = document.querySelector('#show-all-friends-btn');


export function initAccountFriends(): void {
  LoadEventListeners();

  renderFriendsContainer();
};

function LoadEventListeners(): void {
  friendsElement?.addEventListener('click', handleFriendsElementClicks);
};

function renderFriendsContainer(): void {
  if (!accountState.data || !friendsContainer) {
    return;
  };

  const innerFriendsContainer: HTMLDivElement = createDivElement(null, 'friends-container-inner');

  if (accountState.data.friends.length === 0) {
    innerFriendsContainer.appendChild(createParagraphElement('no-friends', 'No friends yet.'));
  };

  for (let i = 0; i < (accountFriendsState.renderLimit || accountState.data.friends.length); i++) {
    const friend: Friend | undefined = accountState.data.friends[i];

    if (!friend) {
      continue;
    };

    innerFriendsContainer.appendChild(createFriendElement(friend));
  };

  friendsContainer.firstElementChild?.remove();
  friendsContainer.appendChild(innerFriendsContainer);

  if (accountFriendsState.renderLimit && accountFriendsState.renderLimit < accountState.data.friends.length) {
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