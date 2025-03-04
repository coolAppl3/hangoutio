import { signUpState } from "./signUpState";
import Cookies from "../global/Cookies";
import { InfoModal } from "../global/InfoModal";
import { minuteMilliseconds } from "../global/clientConstants";

export function displayVerificationExpiryInfoModal(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Verification request expired.',
    description: 'Your account has been automatically deleted as a result, but you can create it again and verify it within 15 minutes.',
    btnTitle: 'Okay',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      clearVerificationCookies();
      reloadWithoutQueryString();
    };
  });
};

export function clearVerificationCookies(): void {
  Cookies.remove('verificationAccountId');
  Cookies.remove('verificationExpiryTimestamp');
};

export function reloadWithoutQueryString(): void {
  const hrefWithoutQueryString: string | undefined = window.location.href.split('?')[0];
  hrefWithoutQueryString && window.location.replace(hrefWithoutQueryString);
};

export function initVerificationTimer(): void {
  const requestExpiryTimer: HTMLSpanElement | null = document.querySelector('#request-expiry-timer');

  if (!requestExpiryTimer) {
    return;
  };

  requestExpiryTimer?.classList.add('displayed');

  const intervalId: number = setInterval(() => updateVerificationTimer(requestExpiryTimer, intervalId), 1000);
  updateVerificationTimer(requestExpiryTimer, intervalId);
};

function updateVerificationTimer(requestExpiryTimer: HTMLSpanElement, intervalId: number): void {
  if (!signUpState.verificationExpiryTimestamp) {
    clearInterval(intervalId);
    requestExpiryTimer.classList.remove('displayed');

    return;
  };

  const timerValue: string = getTimeTillVerificationExpiry(signUpState.verificationExpiryTimestamp);

  if (timerValue === '00:00') {
    requestExpiryTimer.textContent = timerValue;
    clearInterval(intervalId);
    displayVerificationExpiryInfoModal();

    return;
  };

  requestExpiryTimer.textContent = timerValue;
};


function getTimeTillVerificationExpiry(verificationExpiryTimestamp: number): string {
  const timeTillRequestExpiry: number = verificationExpiryTimestamp - Date.now();

  if (timeTillRequestExpiry < 0) {
    return '00:00';
  };

  const minutesTillExpiry: number = Math.floor(timeTillRequestExpiry / minuteMilliseconds);
  const secondsTillExpiry: number = Math.floor((timeTillRequestExpiry / 1000) % 60);

  const minutesTillExpiryString: string = minutesTillExpiry < 10 ? `0${minutesTillExpiry}` : `${minutesTillExpiry}`;
  const secondsTillExpiryString: string = secondsTillExpiry < 10 ? `0${secondsTillExpiry}` : `${secondsTillExpiry}`;

  const timeTillExpiry: string = `${minutesTillExpiryString}:${secondsTillExpiryString}`;

  return timeTillExpiry;
};

export function switchToVerificationStage(): void {
  const signUpSection: HTMLDivElement | null = document.querySelector('#sign-up-section');
  signUpSection?.classList.add('verification-step');

  const verificationCodeInput: HTMLInputElement | null = document.querySelector('#verification-code-input');
  verificationCodeInput && (verificationCodeInput.value = '');

  initVerificationTimer();
};

export function clearAllSignUpInputs(): void {
  const inputs: NodeListOf<HTMLInputElement> = document.querySelectorAll('input');

  for (const input of inputs) {
    input.value = '';
  };
};

export function handleSignedInUser(): void {
  InfoModal.display({
    title: `You're signed in.`,
    description: 'You must sign out before proceeding.',
    btnTitle: 'Okay',
  }, { simple: true });
};