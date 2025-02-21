import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_VOTING_STAGE, hourMilliseconds, minuteMilliseconds } from "../../global/clientConstants";
import { ConfirmModal } from "../../global/ConfirmModal";
import Cookies from "../../global/Cookies";
import { createBtnElement, createDivElement, createParagraphElement, createSpanElement, createSvgElement } from "../../global/domUtils";
import { InfoModal } from "../../global/InfoModal";
import popup from "../../global/popup";
import { isValidHangoutId } from "../../global/validation";
import { getHangoutExistsService } from "../../services/hangoutServices";
import { globalHangoutState } from "../globalHangoutState";
import { getDateAndTimeString } from "../../global/dateTimeUtils";
import { HangoutMessage, HangoutMember, HangoutEvent } from "../hangoutTypes";
import { initHangoutGuestSignUp } from "./initHangoutGuestSignUp";
import LoadingModal from "../../global/LoadingModal";

export function handleInvalidHangoutId(): void {
  const signedInAs: string | null = Cookies.get('signedInAs');

  if (signedInAs === 'guest') {
    handleEmptyHangoutGuestRequest();
    return;
  };

  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Invalid hangout Link.',
    description: `The link you've entered doesn't contain a valid hangout ID.\nRequest a valid link from the hangout leader.`,
    btnTitle: 'Got to homepage',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'home';
    };
  });
};

function handleEmptyHangoutGuestRequest(): void {
  const guestHangoutId: string | null = Cookies.get('guestHangoutId');

  if (!guestHangoutId || !isValidHangoutId(guestHangoutId)) {
    handleInvalidHangoutId();
    return;
  };

  window.location.href = `${window.location.origin}/hangout?id=${guestHangoutId}`;
};

export function handleHangoutConcluded(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Hangout has already been concluded.',
    description: `You're too late to join this one, but you can always create a new one.`,
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

export function handleHangoutNotFound(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Hangout not found.',
    description: 'Reach out to the hangout leader to request a valid link.',
    btnTitle: 'Go to homepage',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'home';
    };
  });
};

export function handleHangoutFull(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Hangout is full.',
    description: 'Reach out to the hangout leader to check if they can increase the member limit.',
    btnTitle: 'Go to homepage',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'home';
      return;
    };
  });
};

export async function handleNotSignedIn(hangoutId: string): Promise<void> {
  LoadingModal.display();
  let isPasswordProtected: boolean = false;

  try {
    isPasswordProtected = (await getHangoutExistsService(hangoutId)).data.isPasswordProtected;
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;

    popup(errMessage, 'error');

    if (status === 403) {
      handleHangoutConcluded();
      return;
    };

    if (status === 404) {
      handleHangoutNotFound();
      return;
    };

    if (status === 400) {
      handleInvalidHangoutId();
      return;
    };

    return;
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Not signed in.',
    description: `You must be signed in to proceed.`,
    confirmBtnTitle: 'Sign in',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: 'Join as a guest',
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      Cookies.set('pendingSignInHangoutId', hangoutId);
      window.location.href = 'sign-in';

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'home';
      return;
    };

    if (e.target.id === 'confirm-modal-other-btn') {
      ConfirmModal.remove();
      initHangoutGuestSignUp(hangoutId, isPasswordProtected);
    };
  });
};

export function removeGuestSignUpSection(): void {
  const guestSignUpSection: HTMLElement | null = document.querySelector('#guest-sign-up-section');
  const hangoutLoadingSkeleton: HTMLDivElement | null = document.querySelector('#hangout-loading-skeleton');

  guestSignUpSection?.remove();
  hangoutLoadingSkeleton?.classList.remove('hidden');
};

export function removeLoadingSkeleton(): void {
  const hangoutDesktopNav: HTMLElement | null = document.querySelector('#hangout-desktop-nav');
  const hangoutDashboardElement: HTMLElement | null = document.querySelector('#dashboard-section');
  const hangoutLoadingSkeleton: HTMLDivElement | null = document.querySelector('#hangout-loading-skeleton');

  hangoutDesktopNav?.parentElement?.parentElement?.classList.remove('hidden');
  hangoutDashboardElement?.classList.remove('hidden');
  hangoutLoadingSkeleton?.remove();
};

export function getHangoutStageTitle(currentStage: number): string {
  const hangoutStages: string[] = ['Availability', 'Suggestions', 'Voting', 'Concluded'];

  if (currentStage < HANGOUT_AVAILABILITY_STAGE || currentStage > HANGOUT_CONCLUSION_STAGE) {
    return 'Failed to load';
  };

  return hangoutStages[currentStage - 1];
};

export function getNextHangoutStageTitle(currentStage: number): string {
  if (currentStage >= HANGOUT_CONCLUSION_STAGE) {
    return 'None';
  };

  if (currentStage === HANGOUT_VOTING_STAGE) {
    return 'Conclusion';
  };

  return getHangoutStageTitle(currentStage + 1);
};

export function initiateNextStageTimer(): void {
  const nextStageTimeSpan: HTMLSpanElement | null = document.querySelector('#dashboard-next-stage-time');

  if (!nextStageTimeSpan) {
    return;
  };

  const intervalId: number = setInterval(() => updateNextStageTimer(nextStageTimeSpan, intervalId), minuteMilliseconds / 2);
  updateNextStageTimer(nextStageTimeSpan, intervalId);
};

function updateNextStageTimer(nextStageTimeSpan: HTMLSpanElement, intervalId: number): void {
  if (!nextStageTimeSpan) {
    clearInterval(intervalId);
    return;
  };

  if (!globalHangoutState.data) {
    nextStageTimeSpan.textContent = 'Failed to load';
    clearInterval(intervalId);
    return;
  };

  const { current_stage, stage_control_timestamp, availability_period, suggestions_period, voting_period } = globalHangoutState.data.hangoutDetails;

  if (current_stage === HANGOUT_CONCLUSION_STAGE) {
    nextStageTimeSpan.textContent = 'None';
    clearInterval(intervalId);

    return;
  };

  const hangoutStageArray: number[] = [availability_period, suggestions_period, voting_period];
  const millisecondsTillNextStage: number = hangoutStageArray[current_stage - 1] - (Date.now() - stage_control_timestamp);

  if (millisecondsTillNextStage < minuteMilliseconds) {
    nextStageTimeSpan.textContent = 'Less than a minute';
    clearInterval(intervalId);

    return;
  };

  const daysTillNextStage: number = Math.floor(millisecondsTillNextStage / dayMilliseconds);
  const hoursTillNextStage: number = Math.floor((millisecondsTillNextStage / hourMilliseconds) % 24);
  const minutesTillNextStage: number = Math.floor((millisecondsTillNextStage / minuteMilliseconds) % 60);

  const timeTillNextStageString: string = `${daysTillNextStage}D:${hoursTillNextStage}H:${minutesTillNextStage}M`;
  nextStageTimeSpan.textContent = timeTillNextStageString;
};

export function getHangoutConclusionDate(): string {
  if (!globalHangoutState.data) {
    return 'Failed to load';
  };

  const { created_on_timestamp, availability_period, suggestions_period, voting_period } = globalHangoutState.data.hangoutDetails
  const conclusionTimestamp: number = created_on_timestamp + availability_period + suggestions_period + voting_period;

  const conclusionDateAndTimeString: string = getDateAndTimeString(conclusionTimestamp);
  return conclusionDateAndTimeString;
};

export function createHangoutMemberElement(hangoutMember: HangoutMember): HTMLButtonElement {
  const memberItem: HTMLButtonElement = createBtnElement('member-item', null);
  memberItem.setAttribute('data-memberId', `${hangoutMember.hangout_member_id}`);
  memberItem.setAttribute('title', 'View member details');
  memberItem.setAttribute('aria-label', 'View member details');

  memberItem.appendChild(createParagraphElement('display-name', hangoutMember.display_name));

  if (hangoutMember.hangout_member_id === globalHangoutState.data?.hangoutMemberId) {
    memberItem.classList.add('user');
  };

  if (hangoutMember.is_leader) {
    memberItem.classList.add('leader');
    memberItem.appendChild(getLeaderIcon());
  };

  return memberItem;
};

function getLeaderIcon(): HTMLDivElement {
  const leaderIcon: HTMLDivElement = createDivElement('leader-icon');
  leaderIcon.setAttribute('title', 'Hangout leader');

  const leaderSvgElement: SVGSVGElement = createSvgElement(540, 540);

  const leaderSvgPathElement: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  leaderSvgPathElement.setAttribute('d', 'M286.748 168.173C297.072 162.086 304 150.852 304 138C304 118.67 288.33 103 269 103C249.67 103 234 118.67 234 138C234 151.04 241.131 162.415 251.707 168.436L196.5 273.376C193.977 278.174 188.09 280.087 183.227 277.689L74.1836 223.909C76.623 219.135 78 213.728 78 208C78 188.67 62.3301 173 43 173C23.6699 173 8 188.67 8 208C8 227.33 23.6699 243 43 243C44.2012 243 45.3887 242.939 46.5586 242.821L64.8477 419.064C65.9062 429.256 74.4941 437 84.7402 437H453.854C464.1 437 472.688 429.256 473.746 419.064L492.039 242.778C493.34 242.925 494.66 243 496 243C515.33 243 531 227.33 531 208C531 188.67 515.33 173 496 173C476.67 173 461 188.67 461 208C461 213.664 462.346 219.015 464.734 223.748L355.367 277.689C350.504 280.087 344.617 278.174 342.094 273.376L286.748 168.173Z');

  leaderSvgElement.appendChild(leaderSvgPathElement);
  leaderIcon.appendChild(leaderSvgElement);

  return leaderIcon;
};

export function createDashboardMessage(message: HangoutMessage): HTMLDivElement {
  const messageElement: HTMLDivElement = createDivElement('message');

  const senderDisplayName: string | undefined = globalHangoutState.data?.hangoutMembersMap.get(message.hangout_member_id);
  messageElement.appendChild(createSpanElement('message-sent-by', senderDisplayName || 'Former member'));

  const messageContent: HTMLDivElement = createDivElement('message-content');

  for (const paragraph of message.message_content.split('\r\n\r\n')) {
    messageContent.appendChild(createParagraphElement(null, paragraph));
  };

  messageElement.appendChild(messageContent);
  messageElement.appendChild(createSpanElement('message-sent-on', getDateAndTimeString(message.message_timestamp)));

  return messageElement;
};

export function createDashboardEvent(hangoutEvent: HangoutEvent): HTMLDivElement {
  const eventElement: HTMLDivElement = createDivElement('event-item');

  eventElement.appendChild(createSpanElement('created-on', getDateAndTimeString(hangoutEvent.event_timestamp)));
  eventElement.appendChild(createParagraphElement('description', hangoutEvent.event_description));

  return eventElement;
};

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    popup('Copied to clipboard.', 'success');

  } catch (err: unknown) {
    console.log(err);
    popup('Failed to copy to clipboard.', 'error');
  };
};