import { recoveryState } from "./recoveryState";
import { InfoModal } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { minuteMilliseconds } from "../global/clientConstants";

export function handleRecoveryExpired(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Recovery request expired.',
    description: null,
    btnTitle: 'Start again',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      reloadWithoutQueryString();
    };
  });
};

export function reloadWithoutQueryString(): void {
  const hrefWithoutQueryString: string = window.location.href.split('?')[0];
  window.location.replace(hrefWithoutQueryString);
};

export function handleUnexpectedError(): void {
  LoadingModal.display();
  popup('Something went wrong.', 'error');
  setTimeout(() => reloadWithoutQueryString(), 1000);
};

export function getMinutesTillRecoveryExpiry(expiryTimestamp: number): number {
  const timeTillRequestExpiry: number = expiryTimestamp - Date.now();

  if (timeTillRequestExpiry <= 0) {
    return 0;
  };

  if (timeTillRequestExpiry < minuteMilliseconds) {
    return 1;
  };

  return Math.ceil(timeTillRequestExpiry / minuteMilliseconds);
};

export function handleRecoverySuspension(errResData: unknown): void {
  if (typeof errResData !== 'object' || errResData === null) {
    return;
  };

  if (!('expiryTimestamp' in errResData) || typeof errResData.expiryTimestamp !== 'number') {
    return;
  };

  const minutesTillExpiry: number = getMinutesTillRecoveryExpiry(errResData.expiryTimestamp);
  const minutesRemainingString: string = minutesTillExpiry === 1 ? '1 minute' : `${minutesTillExpiry} minutes`;

  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Recovery request suspended.',
    description: `Your recovery request has been suspended due to too many failed attempts.\nYou can start the process again in ${minutesRemainingString}.`,
    btnTitle: 'Go to homepage',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'home';
    };
  });
};

export function initRecoveryTimer(): void {
  const requestExpiryTimer: HTMLSpanElement | null = document.querySelector('#recovery-expiry-timer');

  if (!requestExpiryTimer) {
    return;
  };

  requestExpiryTimer?.classList.add('displayed');

  const intervalId: number = setInterval(() => updateExpiryTimer(requestExpiryTimer, intervalId), 1000);
  updateExpiryTimer(requestExpiryTimer, intervalId);
};

export function updateExpiryTimer(requestExpiryTimer: HTMLSpanElement, intervalId: number): void {
  if (!recoveryState.expiryTimestamp) {
    requestExpiryTimer.classList.remove('displayed');
    clearInterval(intervalId);

    return;
  };

  const timerValue: string = getTimeTillRecoveryExpiry(recoveryState.expiryTimestamp);
  requestExpiryTimer.textContent = timerValue;

  if (timerValue === '00:00') {
    clearInterval(intervalId);
    handleRecoveryExpired();
  };
};

function getTimeTillRecoveryExpiry(expiryTimestamp: number): string {
  const millisecondsTillExpiry: number = expiryTimestamp - Date.now();

  if (millisecondsTillExpiry < 0) {
    return '00:00';
  };

  const minutesTillExpiry: number = Math.floor(millisecondsTillExpiry / minuteMilliseconds);
  const secondsTillExpiry: number = Math.floor((millisecondsTillExpiry / 1000) % 60);

  const minutesTillExpiryString: string = minutesTillExpiry < 10 ? `0${minutesTillExpiry}` : `${minutesTillExpiry}`;
  const secondsTillExpiryString: string = secondsTillExpiry < 10 ? `0${secondsTillExpiry}` : `${secondsTillExpiry}`;

  const timeTillExpiry: string = `${minutesTillExpiryString}:${secondsTillExpiryString}`;

  return timeTillExpiry;
};

export function handleSignedInUser(): void {
  InfoModal.display({
    title: `You're signed in.`,
    description: 'You must sign out before proceeding.',
    btnTitle: 'Okay',
  }, { simple: true });
};

export function progressRecovery(recoveryCode?: string): void {
  const accountRecoverySection: HTMLElement | null = document.querySelector('#account-recovery');

  if (!accountRecoverySection) {
    handleUnexpectedError();
    return;
  };

  if (recoveryCode) {
    const recoveryCodeInput: HTMLInputElement | null = document.querySelector('#recovery-code-input');
    recoveryCodeInput && (recoveryCodeInput.value = recoveryCode);
  };

  recoveryState.inPasswordUpdateStage = true;

  initRecoveryTimer();
  disableRecoveryEmailInput();

  accountRecoverySection.className = 'passwordUpdateForm';
};

function disableRecoveryEmailInput(): void {
  const recoveryEmailInput: HTMLInputElement | null = document.querySelector('#recovery-email-input');

  if (!recoveryEmailInput) {
    return;
  };

  recoveryEmailInput.parentElement?.classList.add('disabled');
  recoveryEmailInput.setAttribute('disabled', '');
};