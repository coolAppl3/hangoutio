import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import Cookies from "../../global/Cookies";
import { handleAuthSessionExpired } from "../../global/authUtils";
import popup from "../../global/popup";
import { isValidHangoutId } from "../../global/validation";
import { getInitialHangoutDataService, InitialHangoutData } from "../../services/hangoutServices";
import { globalHangoutState } from "../globalHangoutState";
import { ChatMessage, HangoutEvent, HangoutMember, HangoutsDetails } from "../hangoutTypes";
import { directlyNavigateHangoutSections, navigateHangoutSections } from "../hangoutNav";
import { calculateHangoutConclusionTimestamp, handleIrrecoverableError } from "../globalHangoutUtils";
import { handleNotHangoutMember } from "./handleNotHangoutMember";
import { getHangoutStageTitle, getNextHangoutStageTitle, initiateNextStageTimer, handleHangoutNotFound, handleInvalidHangoutId, handleNotSignedIn, removeLoadingSkeleton, removeGuestSignUpSection, copyToClipboard, createHangoutMemberElement, createDashboardMessage, createDashboardEvent, renderHangoutStageDescriptions } from "./hangoutDashboardUtils";
import { initHangoutWebSocket } from "../../../webSockets/hangout/hangoutWebSocket";
import { createDivElement } from "../../global/domUtils";
import { getDateAndTimeString } from "../../global/dateTimeUtils";

interface HangoutDashboardState {
  nextStageTimerInitiated: boolean,

  latestHangoutEvents: HangoutEvent[],
  latestChatMessages: ChatMessage[],
};

export const hangoutDashboardState: HangoutDashboardState = {
  nextStageTimerInitiated: false,

  latestHangoutEvents: [],
  latestChatMessages: [],
};

const hangoutStageDescriptionElement: HTMLDivElement | null = document.querySelector('#hangout-stage-description');

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

    hangoutDashboardState.latestChatMessages = initialHangoutData.latestChatMessages;
    hangoutDashboardState.latestHangoutEvents = initialHangoutData.latestHangoutEvents;

    renderDashboardSection();

    removeGuestSignUpSection();
    removeLoadingSkeleton();

    initHangoutWebSocket(initialHangoutData.hangoutMemberId, hangoutId);

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Failed to load hangout data.', 'error');
      setTimeout(() => window.location.href = 'home', 1000);

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Failed to load hangout data.', 'error');
      setTimeout(() => window.location.href = 'home', 1000);

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;
    const errResData: unknown = axiosError.response.data.resData;

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

  hangoutStageDescriptionElement?.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.classList.contains('hangout-description-btn')) {
      navigateHangoutSections(e);
      return;
    };
  });
};

export function renderDashboardSection(): void {
  renderMainDashboardContent();
  renderHangoutStageDescriptions();
  renderLatestMessages();
  renderLatestEvents();
  renderMembersSection();
};

function renderMainDashboardContent(): void {
  if (!globalHangoutState.data) {
    handleIrrecoverableError();
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

  const memberLimitSpan: HTMLSpanElement | null = document.querySelector('#dashboard-member-limit');
  memberLimitSpan && (memberLimitSpan.textContent = `${hangoutDetails.members_limit} members`);

  const dashboardViewMembersBtn: HTMLButtonElement | null = document.querySelector('#dashboard-view-members-btn');
  dashboardViewMembersBtn?.addEventListener('click', navigateHangoutSections);

  initiateNextStageTimer();
  displayHangoutPassword();
};

function displayHangoutPassword(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const { isLeader, isPasswordProtected, decryptedHangoutPassword } = globalHangoutState.data;

  const hangoutPasswordStateSpan: HTMLSpanElement | null = document.querySelector('#dashboard-hangout-password-state');
  const hangoutPasswordValueSpan: HTMLSpanElement | null = document.querySelector('#dashboard-hangout-password-value');
  const hangoutPasswordBtn: HTMLInputElement | null = document.querySelector('#dashboard-hangout-password-btn');

  if (!hangoutPasswordStateSpan || !hangoutPasswordValueSpan || !hangoutPasswordBtn) {
    return;
  };

  if (!isLeader) {
    isPasswordProtected && (hangoutPasswordValueSpan.textContent = 'Yes');
    return;
  };

  hangoutPasswordStateSpan.textContent = 'Hangout password';

  if (isPasswordProtected) {
    hangoutPasswordBtn.classList.remove('hidden');
    hangoutPasswordValueSpan.textContent = '*************';

    hangoutPasswordBtn.addEventListener('click', async () => {
      if (!decryptedHangoutPassword) {
        popup('Hangout is not password protected.', 'error');
        return;
      };

      await copyToClipboard(decryptedHangoutPassword);
    });

    return;
  };

  hangoutPasswordValueSpan.textContent = 'Not set';
};

function renderMembersSection(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const { hangoutDetails, hangoutMembers } = globalHangoutState.data;

  const currentMembersSpan: HTMLSpanElement | null = document.querySelector('#dashboard-current-members');
  currentMembersSpan && (currentMembersSpan.textContent = `${hangoutMembers.length}`);

  const membersLimitSpan: HTMLSpanElement | null = document.querySelector('#dashboard-members-limit');
  membersLimitSpan && (membersLimitSpan.textContent = `${hangoutDetails.members_limit}`);

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

function renderLatestMessages(): void {
  if (hangoutDashboardState.latestChatMessages.length === 0) {
    return;
  };

  const dashboardChatContainer: HTMLDivElement | null = document.querySelector('#dashboard-chat-container');
  const dashboardChatEmptyElement: HTMLDivElement | null = document.querySelector('#dashboard-chat-empty');

  if (!dashboardChatContainer || !dashboardChatEmptyElement) {
    return;
  };

  const dashboardChatContainerInner: HTMLDivElement = createDivElement(null, 'dashboard-chat-container-inner');

  for (let i = 0; i < 2; i++) {
    const message: ChatMessage | undefined = hangoutDashboardState.latestChatMessages[i];

    if (!message) {
      break;
    };

    dashboardChatContainerInner.insertAdjacentElement('afterbegin', createDashboardMessage(message));
  };

  dashboardChatContainer.firstElementChild?.remove();
  dashboardChatContainer.insertAdjacentElement('afterbegin', dashboardChatContainerInner);

  dashboardChatContainer.classList.remove('hidden');
  dashboardChatEmptyElement.classList.add('hidden');
};

function renderLatestEvents(): void {
  const dashboardEventsElement: HTMLDivElement | null = document.querySelector('#dashboard-events');

  if (!dashboardEventsElement) {
    popup('Failed to load hangout events.', 'error');
    return;
  };

  const dashboardEventsContainer: HTMLDivElement = createDivElement(null, 'dashboard-events-container');

  for (const event of hangoutDashboardState.latestHangoutEvents) {
    dashboardEventsContainer.appendChild(createDashboardEvent(event));
  };

  dashboardEventsElement.firstElementChild?.remove();
  dashboardEventsElement.appendChild(dashboardEventsContainer);
};

function detectLatestSection(): void {
  const latestHangoutSection: string | null = sessionStorage.getItem('latestHangoutSection');

  if (!latestHangoutSection) {
    return;
  };

  setTimeout(() => directlyNavigateHangoutSections(latestHangoutSection), 0);
};