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
  renderFriendsContainer();
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
};