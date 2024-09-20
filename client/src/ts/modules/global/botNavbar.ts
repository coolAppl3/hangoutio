import Cookies from "./Cookies";
import { isValidAuthToken } from "./validation";

const botNavbarElement: HTMLElement | null = document.querySelector('.bot-nav');
const accountListBtn: HTMLElement | null = document.querySelector('#account-list-btn');
const accountListContainer: HTMLElement | null = document.querySelector('#account-list-container');
const botNavHangoutBtn: HTMLAnchorElement | null = document.querySelector('#bot-nav-hangout-btn');

export default function botNavbar(): void {
  init();
  loadEventListeners();
};

function init(): void {
  displayAdditionalLinks(botNavbarElement);
};

function loadEventListeners(): void {
  accountListBtn?.addEventListener('click', expandAccountList);
  botNavHangoutBtn?.addEventListener('click', handleGuestClicks);
};

function displayAdditionalLinks(botNavbarElement: HTMLElement | null): void {
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken || !isValidAuthToken(authToken)) {
    return;
  };

  botNavbarElement?.classList.add('signed-in');
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

function handleGuestClicks(e: MouseEvent): void {
  e.preventDefault();

  const authToken: string | null = Cookies.get('authToken');
  if (authToken && isValidAuthToken(authToken) && authToken.startsWith('g')) {
    window.location.href = 'hangouts.html';
    return;
  };

  window.location.href = 'create-hangout.html';
};