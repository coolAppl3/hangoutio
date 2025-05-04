import Cookies from "../../global/Cookies";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import popup from "../../global/popup";
import { isValidHangoutId } from "../../global/validation";
import { getInitialHangoutDataService, InitialHangoutData } from "../../services/hangoutServices";
import { globalHangoutState } from "../globalHangoutState";
import { ChatMessage, HangoutEvent, HangoutMember, HangoutsDetails } from "../hangoutTypes";
import { directlyNavigateHangoutSections, navigateHangoutSections } from "../hangoutNav";
import { copyToClipboard } from "../globalHangoutUtils";
import { handleNotHangoutMember } from "./handleNotHangoutMember";
import { getHangoutStageTitle, getNextHangoutStageTitle, initNextStageTimer, handleHangoutNotFound, handleInvalidHangoutId, handleNotSignedIn, removeLoadingSkeleton, removeGuestSignUpSection, createHangoutMemberElement, renderDashboardStageDescriptions } from "./hangoutDashboardUtils";
import { initHangoutWebSocket } from "../../../webSockets/hangout/hangoutWebSocket";
import { createDivElement } from "../../global/domUtils";
import { getDateAndTimeString } from "../../global/dateTimeUtils";
import { ConfirmModal } from "../../global/ConfirmModal";
import LoadingModal from "../../global/LoadingModal";
import { leaveHangoutService } from "../../services/hangoutMemberServices";
import { dayMilliseconds } from "../../global/clientConstants";
import { createMessageDateStampElement, createMessageElement } from "../chat/hangoutChat";
import { AsyncErrorData, getAsyncErrorData } from "../../global/errorUtils";
import { createEventElement } from "../events/hangoutEvents";

interface HangoutDashboardState {
  nextStageTimerInitiated: boolean,
  nextStageTimerIntervalId: number,

  latestHangoutEvents: HangoutEvent[],
  latestChatMessages: ChatMessage[],
};

export const hangoutDashboardState: HangoutDashboardState = {
  nextStageTimerInitiated: false,
  nextStageTimerIntervalId: 0,

  latestHangoutEvents: [],
  latestChatMessages: [],
};

const hangoutDashboardSection: HTMLElement | null = document.querySelector('#dashboard-section');
const dashboardDropdownElement: HTMLDivElement | null = document.querySelector('#dashboard-dropdown');

export async function hangoutDashboard(): Promise<void> {
  await getInitialHangoutData();

  loadEventListeners();
  detectLatestSection();
};

export async function getInitialHangoutData(): Promise<void> {
  const url = new URL(window.location.href);
  const hangoutId: string | null = url.searchParams.get('id');

  if (!hangoutId || !isValidHangoutId(hangoutId)) {
    handleInvalidHangoutId();
    return;
  };

  const signedInAs: string | null = Cookies.get('signedInAs');
  if (!signedInAs) {
    await handleNotSignedIn(hangoutId);
    return;
  };

  try {
    const initialHangoutData: InitialHangoutData = (await getInitialHangoutDataService(hangoutId)).data;
    const hangoutMembersMap: Map<number, string> = new Map();

    for (const member of initialHangoutData.hangoutMembers) {
      hangoutMembersMap.set(member.hangout_member_id, member.display_name);
    };

    globalHangoutState.data = {
      hangoutId,
      hangoutMemberId: initialHangoutData.hangoutMemberId,
      hangoutMembers: initialHangoutData.hangoutMembers,
      hangoutMembersMap,

      isLeader: initialHangoutData.isLeader,
      isPasswordProtected: initialHangoutData.isPasswordProtected,
      decryptedHangoutPassword: initialHangoutData.decryptedHangoutPassword,

      availabilitySlotsCount: initialHangoutData.hangoutMemberCountables.availability_slots_count,
      suggestionsCount: initialHangoutData.hangoutMemberCountables.suggestions_count,
      votesCount: initialHangoutData.hangoutMemberCountables.votes_count,

      conclusionTimestamp: initialHangoutData.conclusionTimestamp,
      hangoutDetails: initialHangoutData.hangoutDetails,
    };

    hangoutDashboardState.latestChatMessages = [...initialHangoutData.latestChatMessages].reverse();
    hangoutDashboardState.latestHangoutEvents = initialHangoutData.latestHangoutEvents;

    renderDashboardSection();

    removeGuestSignUpSection();
    removeLoadingSkeleton();

    initHangoutWebSocket(initialHangoutData.hangoutMemberId, hangoutId);

  } catch (err: unknown) {
    console.log(err);

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason, errResData } = asyncErrorData;

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired(`hangout${window.location.search}`);
        return;
      };

      handleNotHangoutMember(errResData, hangoutId);
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

    popup(errMessage, 'error');
    setTimeout(() => window.location.href = 'home', 1000);
  };
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-dashboard', renderDashboardSection);
  hangoutDashboardSection?.addEventListener('click', handleDashboardSectionClick);
};

export function renderDashboardSection(): void {
  renderDashboardMainContent();
  renderDashboardStageDescriptions();
  renderDashboardLatestMessages();
  renderDashboardLatestEvents();
  renderDashboardMembersContainer();
};

export function renderDashboardMainContent(): void {
  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    return;
  };

  const hangoutDetails: HangoutsDetails = globalHangoutState.data.hangoutDetails;

  const hangoutTitleHeading: HTMLHeadingElement | null = document.querySelector('#hangout-title');
  hangoutTitleHeading && (hangoutTitleHeading.textContent = hangoutDetails.hangout_title);

  const currentStageSpan: HTMLSpanElement | null = document.querySelector('#dashboard-current-stage');
  currentStageSpan && (currentStageSpan.textContent = getHangoutStageTitle(hangoutDetails.current_stage));

  const nextStageSpan: HTMLSpanElement | null = document.querySelector('#dashboard-next-stage');
  nextStageSpan && (nextStageSpan.textContent = getNextHangoutStageTitle(hangoutDetails.current_stage));

  const hangoutConclusionSpan: HTMLSpanElement | null = document.querySelector('#dashboard-conclusion-time');
  hangoutConclusionSpan && (hangoutConclusionSpan.textContent = getDateAndTimeString(globalHangoutState.data.conclusionTimestamp));

  const membersLimitSpan: HTMLSpanElement | null = document.querySelector('#dashboard-members-limit');
  membersLimitSpan && (membersLimitSpan.textContent = `${hangoutDetails.members_limit} members`);

  const dashboardViewMembersBtn: HTMLButtonElement | null = document.querySelector('#dashboard-view-members-btn');
  dashboardViewMembersBtn?.addEventListener('click', navigateHangoutSections);

  initNextStageTimer();
  updateDashboardHangoutPasswordInfo();
};

export function updateDashboardHangoutPasswordInfo(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const { isLeader, isPasswordProtected } = globalHangoutState.data;

  const hangoutPasswordStateSpan: HTMLSpanElement | null = document.querySelector('#dashboard-hangout-password-state');
  const hangoutPasswordValueSpan: HTMLSpanElement | null = document.querySelector('#dashboard-hangout-password-value');
  const hangoutPasswordBtn: HTMLInputElement | null = document.querySelector('#dashboard-hangout-password-btn');

  if (!hangoutPasswordStateSpan || !hangoutPasswordValueSpan || !hangoutPasswordBtn) {
    return;
  };

  if (!isLeader) {
    hangoutPasswordValueSpan.textContent = isPasswordProtected ? 'Yes' : 'No';
    return;
  };

  hangoutPasswordStateSpan.textContent = 'Hangout password';

  if (!isPasswordProtected) {
    hangoutPasswordBtn.classList.add('hidden');
    hangoutPasswordValueSpan.textContent = 'Not set';

    return;
  };

  hangoutPasswordBtn.classList.remove('hidden');
  hangoutPasswordValueSpan.textContent = '*************';
};

export function renderDashboardMembersContainer(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const { hangoutDetails, hangoutMembers } = globalHangoutState.data;

  const membersSpotsDetails: HTMLParagraphElement | null = document.querySelector('#dashboard-members-spots-details');
  membersSpotsDetails && (membersSpotsDetails.textContent = `${hangoutMembers.length} out of ${hangoutDetails.members_limit} spots taken.`);

  listHangoutMembers();
};

function listHangoutMembers(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const hangoutMembers: HangoutMember[] = globalHangoutState.data.hangoutMembers;
  const dashboardMembersElement: HTMLDivElement | null = document.querySelector('#dashboard-members');

  if (!dashboardMembersElement) {
    return;
  };

  pushUserAndLeaderToFront(hangoutMembers);
  const dashboardMembersContainer: HTMLDivElement = createDivElement('dashboard-members-container');

  for (const member of hangoutMembers) {
    dashboardMembersContainer.appendChild(createHangoutMemberElement(member));
  };

  dashboardMembersElement.firstElementChild?.remove();
  dashboardMembersElement.appendChild(dashboardMembersContainer);
};

function pushUserAndLeaderToFront(hangoutMembers: HangoutMember[]): void {
  const userIndex: number = hangoutMembers.findIndex((member: HangoutMember) => member.hangout_member_id === globalHangoutState.data?.hangoutMemberId);

  if (userIndex === -1) {
    return;
  };

  const [userMember] = hangoutMembers.splice(userIndex, 1);
  userMember && hangoutMembers.unshift(userMember);

  if (userMember?.is_leader) {
    return;
  };

  const leaderIndex: number = hangoutMembers.findIndex((member: HangoutMember) => member.is_leader);

  if (leaderIndex === -1) {
    return;
  };

  const [leaderMember] = hangoutMembers.splice(leaderIndex, 1);
  leaderMember && hangoutMembers.splice(1, 0, leaderMember);
};

export function renderDashboardLatestMessages(): void {
  if (hangoutDashboardState.latestChatMessages.length === 0) {
    return;
  };

  const latestChatMessages: ChatMessage[] = hangoutDashboardState.latestChatMessages;
  const dashboardChatContainer: HTMLDivElement | null = document.querySelector('#dashboard-chat-container');

  let senderMemberId: number = 0;
  let lastMessageTimestamp: number = latestChatMessages[0]!.message_timestamp; // guaranteed not undefined

  const innerDashboardChatContainer: HTMLDivElement = createDivElement(null, 'dashboard-chat-container-inner');

  innerDashboardChatContainer.appendChild(createMessageDateStampElement(lastMessageTimestamp));

  for (const message of latestChatMessages) {
    const isUser: boolean = message.hangout_member_id === globalHangoutState.data?.hangoutMemberId;

    const isSameSender: boolean = senderMemberId === message.hangout_member_id;
    const notInSameDay: boolean = Math.abs(lastMessageTimestamp - message.message_timestamp) > dayMilliseconds || new Date(lastMessageTimestamp).getDate() !== new Date(message.message_timestamp).getDate();

    if (notInSameDay) {
      innerDashboardChatContainer?.appendChild(createMessageDateStampElement(message.message_timestamp));
    };

    innerDashboardChatContainer?.appendChild(createMessageElement(message, isSameSender, isUser));

    senderMemberId = message.hangout_member_id;
    lastMessageTimestamp = message.message_timestamp;
  };

  dashboardChatContainer?.firstElementChild?.remove();
  dashboardChatContainer?.appendChild(innerDashboardChatContainer);
};

export function renderDashboardLatestEvents(): void {
  const dashboardEventsElement: HTMLDivElement | null = document.querySelector('#dashboard-events');

  if (!dashboardEventsElement) {
    popup('Failed to load hangout events.', 'error');
    return;
  };

  const dashboardEventsContainer: HTMLDivElement = createDivElement(null, 'dashboard-events-container');

  for (const event of hangoutDashboardState.latestHangoutEvents) {
    dashboardEventsContainer.appendChild(createEventElement(event));
  };

  dashboardEventsElement.firstElementChild?.remove();
  dashboardEventsElement.appendChild(dashboardEventsContainer);
};

function detectLatestSection(): void {
  const latestHangoutSection: string | null = sessionStorage.getItem('latestHangoutSection');
  const latestHangoutSectionHangoutId: string | null = sessionStorage.getItem('latestHangoutSection_hangoutId');

  if (!latestHangoutSection || latestHangoutSection === 'dashboard') {
    return;
  };

  if (latestHangoutSectionHangoutId !== globalHangoutState.data?.hangoutId) {
    sessionStorage.removeItem('latestHangoutSection');
    sessionStorage.removeItem('latestHangoutSection_hangoutId');

    return;
  };

  setTimeout(() => directlyNavigateHangoutSections(latestHangoutSection), 0);
};

async function handleDashboardSectionClick(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.hasAttribute('data-goTo')) {
    navigateHangoutSections(e);
    return;
  };

  if (e.target.id === 'dashboard-hangout-password-btn') {
    handleCopyHangoutPassword();
    return;
  };

  if (e.target.id === 'dashboard-dropdown-menu-btn') {
    dashboardDropdownElement?.classList.toggle('expanded');
    return;
  };

  if (e.target.id === 'copy-invite-link-btn') {
    dashboardDropdownElement?.classList.remove('expanded');
    await copyToClipboard(window.location.href);

    return;
  };

  if (e.target.id === 'leave-hangout-btn') {
    dashboardDropdownElement?.classList.remove('expanded');
    confirmLeaveHangout();
  };
};

async function handleCopyHangoutPassword(): Promise<void> {
  if (!globalHangoutState.data) {
    popup('Failed to copy hangout password.', 'error');
    return;
  };

  const { isLeader, decryptedHangoutPassword } = globalHangoutState.data;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    updateDashboardHangoutPasswordInfo();

    return;
  };

  if (!decryptedHangoutPassword) {
    popup('Hangout is not password protected.', 'error');
    updateDashboardHangoutPasswordInfo();

    return;
  };

  await copyToClipboard(decryptedHangoutPassword);
};

function confirmLeaveHangout(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Are you sure you want to leave this hangout?',
    description: null,
    confirmBtnTitle: 'Leave hangout',
    cancelBtnTitle: 'Cancel',
    extraBtnTitle: null,
    isDangerousAction: true,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      ConfirmModal.remove();
      await leaveHangout();

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};

async function leaveHangout(): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutMemberId, hangoutId } = globalHangoutState.data;

  try {
    await leaveHangoutService(hangoutMemberId, hangoutId);

    popup('Left hangout.', 'success');
    setTimeout(() => window.location.href = 'home', 1000);

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
    };
  };
};