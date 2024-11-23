import { signUpState } from "./signUpState";
import Cookies from "../global/Cookies";
import { InfoModal, InfoModalConfig } from "../global/InfoModal";

export function displayVerificationExpiryInfoModal(): void {
  const infoModalConfig: InfoModalConfig = {
    title: 'Verification request expired.',
    description: 'Your account has been automatically deleted as a result, but you can create it again and verify it within 15 minutes.',
    btnTitle: 'Okay',
  };

  const infoModal: HTMLDivElement = InfoModal.display(infoModalConfig);
  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
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
  Cookies.remove('verificationStartTimestamp');
};

export function reloadWithoutQueryString(): void {
  const hrefWithoutQueryString: string = window.location.href.split('?')[0];
  window.location.replace(hrefWithoutQueryString);
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
  if (!signUpState.verificationStartTimestamp) {
    clearInterval(intervalId);
    requestExpiryTimer.classList.remove('displayed');

    return;
  };

  const timerValue: string = getTimeTillVerificationExpiry(signUpState.verificationStartTimestamp);

  if (timerValue === '00:00') {
    requestExpiryTimer.textContent = timerValue;
    clearInterval(intervalId);
    displayVerificationExpiryInfoModal();

    return;
  };

  requestExpiryTimer.textContent = timerValue;
};


function getTimeTillVerificationExpiry(verificationStartTimestamp: number): string {
  const verificationPeriod: number = 1000 * 60 * 15;
  const expiryTimestamp: number = verificationStartTimestamp + verificationPeriod;
  const timeTillRequestExpiry: number = expiryTimestamp - Date.now();

  if (timeTillRequestExpiry < 0) {
    return '00:00';
  };

  const minutesTillExpiry: number = Math.floor(timeTillRequestExpiry / (1000 * 60));
  const secondsTillExpiry: number = Math.round((timeTillRequestExpiry / 1000) % 60);

  const minutesTillExpiryString: string = minutesTillExpiry < 10 ? `0${minutesTillExpiry}` : `${minutesTillExpiry}`;
  const secondsTillExpiryString: string = secondsTillExpiry < 10 ? `0${secondsTillExpiry}` : `${secondsTillExpiry}`;

  const timeTillExpiry: string = `${minutesTillExpiryString}:${secondsTillExpiryString}`;

  return timeTillExpiry;
};

export function switchToVerificationStage(): void {
  const signUpSection: HTMLDivElement | null = document.querySelector('#sign-up-section');
  signUpSection?.classList.add('verification-step');

  const verificationCodeInput: HTMLInputElement | null = document.querySelector('#verification-code-input');
  verificationCodeInput ? verificationCodeInput.value = '' : undefined;

  initVerificationTimer();
};

export function clearAllSignUpInputs(): void {
  const inputs: NodeListOf<HTMLInputElement> = document.querySelectorAll('input');

  for (const input of inputs) {
    input.value = '';
  };
};