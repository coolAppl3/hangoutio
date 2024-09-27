import { ConfirmModal, ConfirmModalConfig } from "./ConfirmModal";
import Cookies from "./Cookies";
import LoadingModal from "./LoadingModal";
import popup from "./popup";
import { signOut } from "./signOut";
import { isValidAuthToken } from "./validation";

const botNavbarElement: HTMLElement | null = document.querySelector('.bot-nav');
const accountListBtn: HTMLElement | null = document.querySelector('#account-list-btn');
const accountListContainer: HTMLElement | null = document.querySelector('#account-list-container');

export default function botNavbar(): void {
  displayRelevantLinks();
  loadEventListeners();
};

function loadEventListeners(): void {
  accountListBtn?.addEventListener('click', expandAccountList);
  botNavbarElement?.addEventListener('click', handleBotNavbarClicks);
  document.addEventListener('signedOut', displayRelevantLinks);
};

function handleBotNavbarClicks(e: MouseEvent): void {
  if (!(e.target instanceof HTMLEmbedElement)) {
    return;
  };

  if (e.target.classList.contains('sign-out-btn')) {
    e.preventDefault();

    const confirmModalConfig: ConfirmModalConfig = {
      title: 'Are you sure you want to sign out of your account?',
      description: null,
      confirmBtnTitle: 'Confirm',
      cancelBtnTitle: 'Cancel',
      extraBtnTitle: null,
      isDangerousAction: true,
    };

    const confirmModal: HTMLDivElement = ConfirmModal.display(confirmModalConfig);
    confirmModal.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();

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
        return;
      };
    });

    return;
  };
};

function displayRelevantLinks(): void {
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken) {
    botNavbarElement?.classList.remove('guest-user', 'account-user');
    return;
  };

  if (!isValidAuthToken(authToken)) {
    botNavbarElement?.classList.remove('guest-user', 'account-user');
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