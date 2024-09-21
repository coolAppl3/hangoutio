import Cookies from "./Cookies";
import { isValidAuthToken } from "./validation";

const botNavbarElement: HTMLElement | null = document.querySelector('.bot-nav');
const accountListBtn: HTMLElement | null = document.querySelector('#account-list-btn');
const accountListContainer: HTMLElement | null = document.querySelector('#account-list-container');

export default function botNavbar(): void {
  init();
  loadEventListeners();
};

function init(): void {
  displayRelevantLinks(botNavbarElement);
};

function loadEventListeners(): void {
  accountListBtn?.addEventListener('click', expandAccountList);
};

function displayRelevantLinks(botNavbarElement: HTMLElement | null): void {
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken) {
    return;
  };

  if (!isValidAuthToken(authToken)) {
    Cookies.remove('authToken');
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