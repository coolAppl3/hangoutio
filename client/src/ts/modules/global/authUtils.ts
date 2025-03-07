import { ConfirmModal } from "./ConfirmModal";
import Cookies from "./Cookies";

export function handleAuthSessionExpired(afterAuthRedirectHref: string = window.location.href): void {
  const title: string = 'Sign in session expired.';
  const description: string = 'Please sign back in t continue.';

  removeAuthDetails(afterAuthRedirectHref, title, description);
};


export function handleAuthSessionDestroyed(afterAuthRedirectHref: string = window.location.href): void {
  const title: string = 'Invalid sign in credentials detected.';
  const description: string = `You've been signed out as a result. Please sign back in to continue.`;

  removeAuthDetails(afterAuthRedirectHref, title, description);
};

function removeAuthDetails(afterAuthRedirectHref: string, title: string, description: string): void {
  removeRelevantCookies();
  document.dispatchEvent(new CustomEvent('signedOut'));

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title,
    description,
    confirmBtnTitle: 'Sign back in',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
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