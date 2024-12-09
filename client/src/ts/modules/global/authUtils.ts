import { ConfirmModal } from "./ConfirmModal";
import Cookies from "./Cookies";
import { InfoModal } from "./InfoModal";

export function handleAuthSessionExpired(afterAuthRedirectHref: string): void {
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

export function handleAuthSessionDestroyed(afterAuthRedirectHref: string): void {
  removeRelevantCookies();
  dispatchEvent(new CustomEvent('signedOut'));

  Cookies.set('afterAuthRedirectHref', afterAuthRedirectHref);

  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Invalid sign in credentials detected.',
    description: `You've been signed out. Please sign back in to continue.`,
    btnTitle: 'Sign back in',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = afterAuthRedirectHref;
    };
  });
};

function removeRelevantCookies(): void {
  Cookies.remove('signedInAs');
  Cookies.remove('guestHangoutId');
};