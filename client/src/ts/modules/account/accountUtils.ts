import { getDateAndTimeString } from "../global/dateTimeUtils";
import { InfoModal } from "../global/InfoModal";
import { removeSignInCookies } from "../global/signOut";
import { accountDetailsState } from "./accountDetails";

export function removeLoadingSkeleton(): void {
  document.querySelector('#loading-skeleton')?.remove();
  document.querySelectorAll('section').forEach((section: HTMLElement) => section.classList.remove('hidden'));

  document.documentElement.scrollTop = 0;
};

export function handleAccountLocked(): void {
  removeSignInCookies();

  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Account locked.',
    description: 'Your account was locked due to too entering the incorrect password too many times.',
    btnTitle: 'Okay',
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

export function handleOngoingRequest(errResData: unknown, ongoingRequestTitle: string): void {
  if (typeof errResData !== 'object' || errResData === null) {
    return;
  };

  if (!('expiryTimestamp' in errResData) || typeof errResData.expiryTimestamp !== 'number') {
    return;
  };

  if (!Number.isInteger(errResData.expiryTimestamp)) {
    return;
  };

  const requestExpiryDate: string = getDateAndTimeString(errResData.expiryTimestamp);

  InfoModal.display({
    title: `Ongoing ${ongoingRequestTitle} request found.`,
    description: `It will expire on ${requestExpiryDate}.`,
    btnTitle: 'Okay',
  }, { simple: true });
};

export function handleOngoingOpposingRequest(ongoingRequestTitle: string,): void {
  InfoModal.display({
    title: `Ongoing ${ongoingRequestTitle} request found.`,
    description: `You have to either complete or abort the ${ongoingRequestTitle} request before being able to continue.`,
    btnTitle: 'Okay',
  }, { simple: true });
};

export function handleRequestSuspended(errResData: unknown, ongoingRequestTitle: 'email update' | 'account deletion'): void {
  if (typeof errResData !== 'object' || errResData === null) {
    return;
  };

  if (!('expiryTimestamp' in errResData) || typeof errResData.expiryTimestamp !== 'number') {
    return;
  };

  if (!Number.isInteger(errResData.expiryTimestamp)) {
    return;
  };

  if (ongoingRequestTitle === 'account deletion') {
    accountDetailsState.accountDeletionSuspensionExpiryTimestamp = errResData.expiryTimestamp;
  };

  if (ongoingRequestTitle === 'email update') {
    accountDetailsState.emailUpdateSuspensionExpiryTimestamp = errResData.expiryTimestamp;
  };

  displayRequestSuspendedInfoModal(ongoingRequestTitle, errResData.expiryTimestamp);
};

export function displayRequestSuspendedInfoModal(requestTitle: string, suspensionExpiryTimestamp: number): void {
  InfoModal.display({
    title: `Request suspended.`,
    description: `Your ${requestTitle} request has been suspended due to too many failed attempts\nYou can start a new one after ${suspensionExpiryTimestamp}.`,
    btnTitle: 'Okay',
  }, { simple: true });
};