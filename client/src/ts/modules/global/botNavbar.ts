import { ConfirmModal } from "./ConfirmModal";
import Cookies from "./Cookies";
import LoadingModal from "./LoadingModal";
import { signOut } from "./signOut";

const botNavbarElement: HTMLElement | null = document.querySelector('.bot-nav');
const accountListBtn: HTMLElement | null = document.querySelector('#account-list-btn');
const accountListContainer: HTMLElement | null = document.querySelector('#account-list-container');

export default function botNavbar(): void {
  displayRelevantLinks();
  loadEventListeners();
};

function loadEventListeners(): void {
  accountListBtn?.addEventListener('click', toggleAccountList);
  botNavbarElement?.addEventListener('click', handleBotNavbarClicks);
  document.addEventListener('signedOut', displayRelevantLinks);
};

function handleBotNavbarClicks(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.classList.contains('sign-out-btn')) {
    e.preventDefault();
    displaySignOutModal();
  };
};

function displayRelevantLinks(): void {
  const signedInAs: string | null = Cookies.get('signedInAs');

  if (!signedInAs) {
    botNavbarElement?.classList.remove('guest-user', 'account-user');
    return;
  };

  if (signedInAs === 'guest') {
    botNavbarElement?.classList.add('guest-user');
    return;
  };

  botNavbarElement?.classList.add('account-user');
};

function toggleAccountList(): void {
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

function displaySignOutModal(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Are you sure you want to sign out of your account?',
    description: null,
    confirmBtnTitle: 'Sign out',
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
      await signOut();

      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};

export const botNavbarTestOnlyExports = {
  handleBotNavbarClicks,
  displayRelevantLinks,
  toggleAccountList,
  displaySignOutModal,
};