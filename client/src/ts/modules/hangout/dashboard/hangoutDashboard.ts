import axios, { AxiosError, AxiosResponse } from "../../../../../node_modules/axios/index";
import Cookies from "../../global/Cookies";
import { handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_AVAILABILITY_SLOTS_LIMIT, HANGOUT_SUGGESTIONS_LIMIT } from "../../global/clientConstants";
import popup from "../../global/popup";
import { isValidHangoutId } from "../../global/validation";
import { getInitialHangoutData, InitialHangoutData, InitialHangoutDataResponse } from "../../services/hangoutServices";
import { globalHangoutState } from "../globalHangoutState";
import { HangoutMessage, HangoutEvent, HangoutMember, HangoutsDetails } from "../hangoutDataTypes";
import { navigateHangoutSections } from "../hangoutNav";
import { handleIrrecoverableError } from "../hangoutUtils";
import { handleNotHangoutMember } from "./handleNotHangoutMember";
import { getHangoutStageTitle, getNextHangoutStageTitle, initiateNextStageTimer, handleHangoutNotFound, handleInvalidHangoutId, handleNotSignedIn, hideLoadingSkeleton, removeGuestSignUpSection, getHangoutConclusionDate, copyToClipboard, createHangoutMemberElement, createDashboardMessage, createDashboardEvent } from "./hangoutDashboardUtils";

interface HangoutDashboardState {
  latestHangoutEvents: HangoutEvent[],
  latestHangoutMessages: HangoutMessage[],
};

const hangoutDashboardState: HangoutDashboardState = {
  latestHangoutEvents: [],
  latestHangoutMessages: [],
};

export async function hangoutDashboard(): Promise<void> {
  await getHangoutDashboardData();;
};

export async function getHangoutDashboardData(): Promise<void> {
  const url = new URL(window.location.href);
  const hangoutId: string | null = url.searchParams.get('hangoutId');

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
    const initialHangoutDataResponse: AxiosResponse<InitialHangoutDataResponse> = await getInitialHangoutData(hangoutId);
    const initialHangoutData: InitialHangoutData = initialHangoutDataResponse.data.resData;

    globalHangoutState.data = {
      hangoutId,
      hangoutMemberId: initialHangoutData.hangoutMemberId,
      hangoutMembers: initialHangoutData.hangoutMembers,

      isLeader: initialHangoutData.isLeader,
      isPasswordProtected: initialHangoutData.isPasswordProtected,
      decryptedHangoutPassword: initialHangoutData.decryptedHangoutPassword,

      availabilitySlotsCount: initialHangoutData.hangoutMemberCountables.availability_slots_count,
      suggestionsCount: initialHangoutData.hangoutMemberCountables.suggestions_count,
      votesCount: initialHangoutData.hangoutMemberCountables.votes_count,

      hangoutDetails: initialHangoutData.hangoutDetails,
    };

    hangoutDashboardState.latestHangoutMessages = initialHangoutData.latestHangoutChats.reverse();
    hangoutDashboardState.latestHangoutEvents = initialHangoutData.latestHangoutEvents.reverse();

    populateDashboard();

    removeGuestSignUpSection();
    hideLoadingSkeleton();

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.href = 'home', 1000);

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
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

      if (errReason === 'notMember') {
        handleNotHangoutMember(errResData, hangoutId);
      };

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

function populateDashboard(): void {
  populateMainDashboardContent();
  populateHangoutStageDescriptions();
  displayLatestMessages();
  displayLatestEvents();
  populateMembersSection();
};

function populateMainDashboardContent(): void {
  if (!globalHangoutState.data) {
    handleIrrecoverableError();
    return;
  };

  const hangoutDetails: HangoutsDetails = globalHangoutState.data.hangoutDetails;

  const hangoutTitle: HTMLHeadingElement | null = document.querySelector('#hangout-title');
  hangoutTitle && (hangoutTitle.textContent = hangoutDetails.hangout_title);

  const currentStage: HTMLSpanElement | null = document.querySelector('#dashboard-current-stage');
  currentStage && (currentStage.textContent = getHangoutStageTitle(hangoutDetails.current_stage));

  const nextStage: HTMLSpanElement | null = document.querySelector('#dashboard-next-stage');
  nextStage && (nextStage.textContent = getNextHangoutStageTitle(hangoutDetails.current_stage));

  const hangoutConclusion: HTMLSpanElement | null = document.querySelector('#dashboard-conclusion-time');
  hangoutConclusion && (hangoutConclusion.textContent = getHangoutConclusionDate());

  const memberLimit: HTMLSpanElement | null = document.querySelector('#dashboard-member-limit');
  memberLimit && (memberLimit.textContent = `${hangoutDetails.members_limit} members`);

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

  const hangoutPasswordState: HTMLSpanElement | null = document.querySelector('#dashboard-hangout-password-state');
  const hangoutPasswordValue: HTMLSpanElement | null = document.querySelector('#dashboard-hangout-password-value');
  const hangoutPasswordBtn: HTMLInputElement | null = document.querySelector('#dashboard-hangout-password-btn');

  if (!hangoutPasswordState || !hangoutPasswordValue || !hangoutPasswordBtn) {
    return;
  };

  if (!isLeader) {
    isPasswordProtected && (hangoutPasswordValue.textContent = 'Yes');
    return;
  };

  hangoutPasswordState.textContent = 'Hangout password';

  if (isPasswordProtected) {
    hangoutPasswordBtn.classList.remove('hidden');
    hangoutPasswordValue.textContent = '*************';

    hangoutPasswordBtn.addEventListener('click', async () => {
      if (!decryptedHangoutPassword) {
        popup('Hangout is not password protected.', 'error');
        return;
      };

      await copyToClipboard(decryptedHangoutPassword);
    });

    return;
  };

  hangoutPasswordValue.textContent = 'None';
};

function populateHangoutStageDescriptions(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const { hangoutDetails, availabilitySlotsCount, suggestionsCount, votesCount } = globalHangoutState.data;

  const hangoutStageDescription: HTMLDivElement | null = document.querySelector('#hangout-stage-description');
  hangoutStageDescription?.setAttribute('data-hangoutStage', `${hangoutDetails.current_stage}`);

  hangoutStageDescription?.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.hasAttribute('data-goTo')) {
      navigateHangoutSections(e);
    };
  });

  const slotsAdded: HTMLSpanElement | null = document.querySelector('#dashboard-slots-added');
  const slotsRemaining: HTMLSpanElement | null = document.querySelector('#dashboard-slots-remaining');

  if (slotsAdded && slotsRemaining) {
    slotsAdded.textContent = availabilitySlotsCount === 1 ? '1 slot' : `${availabilitySlotsCount} slots`;

    const slotsRemainingCount: number = HANGOUT_AVAILABILITY_SLOTS_LIMIT - availabilitySlotsCount;
    slotsRemaining.textContent = slotsRemainingCount === 1 ? '1 slot' : `${slotsRemainingCount} slots`;
  };

  const suggestionsAdded: HTMLSpanElement | null = document.querySelector('#dashboard-suggestions-added');
  const suggestionsRemaining: HTMLSpanElement | null = document.querySelector('#dashboard-suggestions-remaining');

  if (suggestionsAdded && suggestionsRemaining) {
    suggestionsAdded.textContent = suggestionsCount === 1 ? '1 suggestion' : `${availabilitySlotsCount} suggestions`;

    const suggestionsRemainingCount: number = HANGOUT_SUGGESTIONS_LIMIT - availabilitySlotsCount;
    suggestionsRemaining.textContent = suggestionsRemainingCount === 1 ? '1 suggestion' : `${suggestionsRemainingCount} suggestions`;
  };

  const votesAdded: HTMLSpanElement | null = document.querySelector('#dashboard-votes-added');
  const votesRemaining: HTMLSpanElement | null = document.querySelector('#dashboard-votes-remaining');

  if (votesAdded && votesRemaining) {
    votesAdded.textContent = votesCount === 1 ? '1 vote' : `${availabilitySlotsCount} votes`;

    const votesRemainingCount: number = HANGOUT_SUGGESTIONS_LIMIT - availabilitySlotsCount;
    votesRemaining.textContent = votesRemainingCount === 1 ? '1 vote' : `${votesRemainingCount} votes`;
  };

};

function populateMembersSection(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const { hangoutDetails, hangoutMembers } = globalHangoutState.data;

  const currentMembers: HTMLSpanElement | null = document.querySelector('#dashboard-current-members');
  currentMembers && (currentMembers.textContent = `${hangoutMembers.length}`);

  const membersLimit: HTMLSpanElement | null = document.querySelector('#dashboard-members-limit');
  membersLimit && (membersLimit.textContent = `${hangoutDetails.members_limit}`);

  listHangoutMembers();
};

function listHangoutMembers(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const hangoutMembers: HangoutMember[] = globalHangoutState.data.hangoutMembers;
  const dashboardMembers: HTMLDivElement | null = document.querySelector('#dashboard-members');

  if (!dashboardMembers) {
    return;
  };

  const membersContainer: HTMLDivElement = document.createElement('div');
  membersContainer.className = 'dashboard-members-container';

  pushUserAndLeaderToFront(hangoutMembers);

  for (const member of hangoutMembers) {
    membersContainer.appendChild(createHangoutMemberElement(member));
  };

  dashboardMembers.appendChild(membersContainer);
};

function pushUserAndLeaderToFront(hangoutMembers: HangoutMember[]): void {
  const userIndex: number = hangoutMembers.findIndex((member: HangoutMember) => member.hangout_member_id === globalHangoutState.data?.hangoutMemberId);

  if (userIndex === -1) {
    return;
  };

  const [userMember] = hangoutMembers.splice(userIndex, 1);
  hangoutMembers.unshift(userMember);

  if (userMember.is_leader) {
    return;
  };

  const leaderIndex: number = hangoutMembers.findIndex((member: HangoutMember) => member.is_leader);

  if (leaderIndex === -1) {
    return;
  };

  const [leaderMember] = hangoutMembers.splice(leaderIndex, 1);
  hangoutMembers.splice(1, 0, leaderMember);
};

function displayLatestMessages(): void {
  if (hangoutDashboardState.latestHangoutMessages.length === 0) {
    return;
  };

  const dashboardChatContainer: HTMLDivElement | null = document.querySelector('#dashboard-chat-container');
  const dashboardChatEmpty: HTMLDivElement | null = document.querySelector('#dashboard-chat-empty');

  if (!dashboardChatContainer || !dashboardChatEmpty) {
    return;
  };

  const dashboardChatContainerInner: HTMLDivElement = document.createElement('div');
  dashboardChatContainerInner.id = 'dashboard-chat-container-inner';

  for (const message of hangoutDashboardState.latestHangoutMessages) {
    dashboardChatContainerInner.appendChild(createDashboardMessage(message));
  };

  dashboardChatContainer.insertAdjacentElement('afterbegin', dashboardChatContainerInner);

  dashboardChatContainer.classList.remove('hidden');
  dashboardChatEmpty.classList.add('hidden');
};

function displayLatestEvents(): void {
  const dashboardEventsContainer: HTMLDivElement | null = document.querySelector('#dashboard-events-container');

  if (!dashboardEventsContainer) {
    popup('Failed to load hangout events.', 'error');
    return;
  };

  for (const event of hangoutDashboardState.latestHangoutEvents) {
    dashboardEventsContainer.appendChild(createDashboardEvent(event));
  };
};