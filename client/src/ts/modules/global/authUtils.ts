import { ConfirmModal } from "./ConfirmModal";
import Cookies from "./Cookies";

export function handleAuthSessionExpired(afterAuthRedirectHref: string = window.location.href): void {
  removeRelevantCookies();
  document.dispatchEvent(new CustomEvent('signedOut'));

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Sign in session expired.',
    description: 'Please sign back in to continue.',
    confirmBtnTitle: 'Sign back in',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      Cookies.set('afterAuthRedirectHref', afterAuthRedirectHref);
      window.location.href = 'sign-in';

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'home';
    };
  });
};

export function handleAuthSessionDestroyed(afterAuthRedirectHref: string = window.location.href): void {
  removeRelevantCookies();
  dispatchEvent(new CustomEvent('signedOut'));

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Invalid sign in credentials detected.',
    description: `You've been signed out as a result. Please sign back in to continue.`,
    confirmBtnTitle: 'Sign back in',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      Cookies.set('afterAuthRedirectHref', afterAuthRedirectHref);
      window.location.href = 'sign-in';

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'home';
    };
  });
};

function removeRelevantCookies(): void {
  Cookies.remove('signedInAs');
  Cookies.remove('guestHangoutId');
};