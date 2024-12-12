import { recoveryState } from "./recoveryState";
import { InfoModal } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";

export function handleRecoveryExpired(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Recovery request expired.',
    description: null,
    btnTitle: 'Start again',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      reloadWithoutQueryString();
    };
  });
};

export function updateDisplayedForm(): void {
  const accountRecoverySection: HTMLElement | null = document.querySelector('#account-recovery');

  if (!accountRecoverySection) {
    LoadingModal.display();
    popup('Something went wrong.', 'error');
    setTimeout(() => reloadWithoutQueryString());

    return;
  };

  accountRecoverySection.className = recoveryState.currentStage;
};

export function reloadWithoutQueryString(): void {
  const hrefWithoutQueryString: string = window.location.href.split('?')[0];
  window.location.replace(hrefWithoutQueryString);
};

export function getMinutesTillRecoveryExpiry(expiryTimestamp: number): number {
  const minuteMilliseconds: number = 1000 * 60;
  const timeTillRequestExpiry: number = expiryTimestamp - Date.now();

  if (timeTillRequestExpiry <= 0) {
    return 0;
  };

  if (timeTillRequestExpiry < minuteMilliseconds) {
    return 1;
  };

  return Math.ceil(timeTillRequestExpiry / minuteMilliseconds);
};

export function handleRecoverySuspended(expiryTimestamp: number): void {
  const minutesTillRecoveryExpiry: number = getMinutesTillRecoveryExpiry(expiryTimestamp);
  const minutesRemainingString: string = minutesTillRecoveryExpiry === 1 ? '1 minute' : `${minutesTillRecoveryExpiry} minutes`;

  InfoModal.display({
    title: 'Recovery suspended.',
    description: `You can start the recovery process again in ${minutesRemainingString}.`,
    btnTitle: 'Okay',
  }, { simple: true });
};

export function initRecoveryTimers(): void {
  const requestExpiryTimers: NodeListOf<HTMLSpanElement> = document.querySelectorAll('.request-expiry-timer');

  for (const timer of requestExpiryTimers) {
    timer.classList.add('displayed');
  };

  const intervalId: number = setInterval(() => updateExpiryTimers(requestExpiryTimers, intervalId), 1000);
  updateExpiryTimers(requestExpiryTimers, intervalId);
};

export function updateExpiryTimers(requestExpiryTimers: NodeListOf<HTMLSpanElement>, intervalId: number): void {
  if (!recoveryState.expiryTimestamp) {
    for (const timer of requestExpiryTimers) {
      timer.classList.remove('displayed');
    };

    clearInterval(intervalId);
    return;
  };

  const timerValue: string = getTimeTillRecoveryExpiry(recoveryState.expiryTimestamp);

  for (const timer of requestExpiryTimers) {
    timer.textContent = timerValue;
  };

  if (timerValue === '00:00') {
    clearInterval(intervalId);
    handleRecoveryExpired();
  };
};

function getTimeTillRecoveryExpiry(expiryTimestamp: number): string {
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

export function handleSignedInUser(): void {
  InfoModal.display({
    title: `You're signed in.`,
    description: 'You must sign out before proceeding.',
    btnTitle: 'Okay',
  }, { simple: true });
};