import { getAuthToken } from "./getAuthToken";
import popup from "./popup";
import { signOut } from "./signOut";

const botNavbarElement: HTMLElement | null = document.querySelector('.bot-nav');
const accountListBtn: HTMLElement | null = document.querySelector('#account-list-btn');
const accountListContainer: HTMLElement | null = document.querySelector('#account-list-container');

export default function botNavbar(): void {
  displayRelevantLinks();
  loadEventListeners();
};

function loadEventListeners(): void {
  accountListBtn?.addEventListener('click', expandAccountList);
  document.addEventListener('signedOut', displayRelevantLinks);
  botNavbarElement?.addEventListener('click', handleBotNavbarClicks);
};

function handleBotNavbarClicks(e: MouseEvent): void {
  if (e.target instanceof HTMLElement && e.target.classList.contains('sign-out-btn')) {
    e.preventDefault();

    signOut();
    popup('Signed out successfully.', 'success');

    return;
  };
};

function displayRelevantLinks(): void {
  const authToken: string | null = getAuthToken();

  if (!authToken) {
    botNavbarElement?.classList.remove('guest-user', 'account-user');
    return;
  };

  if (authToken.startsWith('g')) {
    botNavbarElement?.classList.add('guest-user');
    return;
  };

  botNavbarElement?.classList.add('account-user');
};

function expandAccountList(): void {
  if (accountListBtn?.classList.contains('expanded')) {
    setTimeout(() => accountListBtn?.classList.remove('expanded'), 150);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (accountListContainer) {
          accountListContainer.style.opacity = '0';
        };
      });
    });

    return;
  };

  accountListBtn?.classList.add('expanded');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (accountListContainer) {
        accountListContainer.style.opacity = '1';
      };
    });
  });
};