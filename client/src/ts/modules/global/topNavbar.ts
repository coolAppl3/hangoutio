import themeSwitcher from "./themeSwitcher"
import { signOut } from "./signOut";
import popup from "./popup";
import LoadingModal from "./LoadingModal";
import Cookies from "./Cookies";
import { isValidAuthToken } from "./validation";
import { ConfirmModal } from "./ConfirmModal";

const topNavbarElement: HTMLElement | null = document.querySelector('.top-nav');
const accountNavBtn: HTMLButtonElement | null = document.querySelector('#account-nav-container-btn');

export default function topNavbar(): void {
  themeSwitcher();
  displayRelevantLinks();
  loadEventListeners();
};

function loadEventListeners(): void {
  accountNavBtn?.addEventListener('click', enableAccountNavBtn);
  topNavbarElement?.addEventListener('click', handleTopNavbarClicks);
  document.addEventListener('signedOut', displayRelevantLinks);
};

function handleTopNavbarClicks(e: MouseEvent): void {
  if (!(e.target instanceof HTMLElement)) {
    return;
  };

  if (e.target.classList.contains('sign-out-btn')) {
    e.preventDefault();
    displaySignOutModal();
  };
};

function enableAccountNavBtn(): void {
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
    topNavbarElement?.classList.remove('guest-user', 'account-user');
    Cookies.remove('authToken');

    return;
  };

  if (authToken.startsWith('g')) {
    topNavbarElement?.classList.add('guest-user');
    return;
  };

  topNavbarElement?.classList.add('account-user');
};

function displaySignOutModal(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Are you sure you want to sign out of your account?',
    description: null,
    confirmBtnTitle: 'Confirm',
    cancelBtnTitle: 'Cancel',
    extraBtnTitle: null,
    isDangerousAction: true,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      LoadingModal.display();
      signOut();
      popup('Signed out successfully.', 'success');
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};