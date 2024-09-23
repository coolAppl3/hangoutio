import themeSwitcher from "./themeSwitcher"
import Cookies from "./Cookies";
import { isValidAuthToken } from "./validation";
import { signOut } from "./signOut";
import popup from "./popup";

const topNavbarElement: HTMLElement | null = document.querySelector('.top-nav');
const accountNavBtn: HTMLButtonElement | null = document.querySelector('#account-nav-container-btn');

export default function topNavbar(): void {
  themeSwitcher();
  displayRelevantLinks();
  loadEventListeners();
};

function loadEventListeners(): void {
  accountNavBtn?.addEventListener('click', enableAccountNavBtn);
  document.addEventListener('signedOut', displayRelevantLinks);
  topNavbarElement?.addEventListener('click', handleTopNavbarClicks);
};

function handleTopNavbarClicks(e: MouseEvent): void {
  if (e.target instanceof HTMLElement && e.target.classList.contains('sign-out-btn')) {
    e.preventDefault();

    signOut();
    popup('Signed out successfully.', 'success');

    return;
  };
};

function enableAccountNavBtn(e: MouseEvent): void {
  e.preventDefault();

  const accountContainerLinks: HTMLDivElement | null = document.querySelector('#account-nav-container-links');

  if (accountContainerLinks?.classList.contains('expanded')) {
    accountNavBtn?.classList.remove('expanded')

    setTimeout(() => accountContainerLinks.classList.remove('expanded'), 150);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        accountContainerLinks.style.opacity = '0';
      });
    });

    return;
  };

  accountNavBtn?.classList.add('expanded')
  accountContainerLinks?.classList.add('expanded');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      accountContainerLinks ? accountContainerLinks.style.opacity = '1' : undefined;
    });
  });
};

function displayRelevantLinks(): void {
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken) {
    topNavbarElement?.classList.remove('guest-user', 'account-user');
    return;
  };

  if (!isValidAuthToken(authToken)) {
    Cookies.remove('authToken');
    topNavbarElement?.classList.remove('guest-user', 'account-user');

    return;
  };

  if (authToken.startsWith('g')) {
    topNavbarElement?.classList.add('guest-user');
    return;
  };

  topNavbarElement?.classList.add('account-user');
};