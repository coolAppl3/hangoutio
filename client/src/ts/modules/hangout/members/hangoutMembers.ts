import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_CONCLUSION_STAGE } from "../../global/clientConstants";
import { ConfirmModal } from "../../global/ConfirmModal";
import Cookies from "../../global/Cookies";
import { debounce } from "../../global/debounce";
import { createDivElement, createParagraphElement } from "../../global/domUtils";
import { AsyncErrorData, getAsyncErrorData } from "../../global/errorUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { sendFriendRequestService } from "../../services/accountServices";
import { claimHangoutLeadershipService, kickHangoutMemberService, transferHangoutLeadershipService, relinquishHangoutLeadershipService } from "../../services/hangoutMemberServices";
import { globalHangoutState } from "../globalHangoutState";
import { updateHangoutSettingsNavButtons } from "../hangoutNav";
import { HangoutMember } from "../hangoutTypes";
import { createMemberElement } from "./membersUtils";

interface HangoutMembersState {
  isLoaded: boolean,

  hasLeader: boolean,
  dismissedLeadershipClaim: boolean,

  filteredMembers: HangoutMember[],
  membersSectionMutationObserverActive: boolean,
};

export const hangoutMembersState: HangoutMembersState = {
  isLoaded: false,

  hasLeader: true,
  dismissedLeadershipClaim: false,

  filteredMembers: [],
  membersSectionMutationObserverActive: false,
};

const membersSection: HTMLElement | null = document.querySelector('#members-section');

const membersHeader: HTMLDivElement | null = document.querySelector('#members-header');
const membersContainer: HTMLDivElement | null = document.querySelector('#members-container');

const claimLeadershipContainer: HTMLDivElement | null = document.querySelector('#claim-leadership-container');
const membersSearchInput: HTMLInputElement | null = document.querySelector('#members-search-input');

export function hangoutMembers(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-members', initHangoutMembers);

  membersHeader?.addEventListener('click', handleMembersHeaderClicks);
  membersContainer?.addEventListener('click', handleMembersContainerClicks);

  membersSearchInput?.addEventListener('input', debounceMembersSearch);
};

function initHangoutMembers(): void {
  if (hangoutMembersState.isLoaded) {
    renderMembersSection();
    return;
  };

  if (!globalHangoutState.data) {
    return;
  };

  hangoutMembersState.hasLeader = hangoutHasLeader();
  hangoutMembersState.filteredMembers = [...globalHangoutState.data.hangoutMembers];
  hangoutMembersState.isLoaded = true;

  renderMembersSection();
};

export function renderMembersSection(): void {
  renderMembersContainer();
  renderClaimLeadershipContainer();
  updateHangoutSettingsNavButtons();

  if (!hangoutMembersState.membersSectionMutationObserverActive) {
    initMembersSectionMutationObserver();
  };
};

function renderMembersContainer(): void {
  if (!globalHangoutState.data || !membersContainer) {
    popup('Failed to load hangout members.', 'error');
    return;
  };

  const renderingForLeader: boolean = globalHangoutState.data.isLeader;
  const renderingForGuest: boolean = Cookies.get('signedInAs') === 'guest';

  const innerMembersContainer: HTMLDivElement = createDivElement(null, 'members-container-inner');

  for (const member of hangoutMembersState.filteredMembers) {
    innerMembersContainer.appendChild(createMemberElement(member, renderingForLeader, renderingForGuest));
  };

  if (hangoutMembersState.filteredMembers.length === 0) {
    innerMembersContainer.classList.add('empty');
    innerMembersContainer.appendChild(createParagraphElement('no-members-found', 'No members found'));
  };

  membersContainer.firstElementChild?.remove();
  membersContainer.appendChild(innerMembersContainer);
};

function renderClaimLeadershipContainer(): void {
  if (globalHangoutState.data?.hangoutDetails.is_concluded) {
    claimLeadershipContainer?.classList.add('hidden');
    return;
  };

  if (!hangoutMembersState.hasLeader && !hangoutMembersState.dismissedLeadershipClaim) {
    claimLeadershipContainer?.classList.remove('hidden');
    return;
  };

  claimLeadershipContainer?.classList.add('hidden');
};

async function handleMembersHeaderClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'claim-leadership-btn') {
    await claimHangoutLeadership();
    return;
  };

  if (e.target.id === 'dismiss-claim-leadership-container') {
    hangoutMembersState.dismissedLeadershipClaim = true;
    claimLeadershipContainer?.classList.add('hidden');
  };
};

async function handleMembersContainerClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (!globalHangoutState.data) {
    return;
  };

  if (e.target.classList.contains('dropdown-menu-btn')) {
    e.target.parentElement?.classList.toggle('expanded');
    return;
  };

  const memberElement: HTMLDivElement | null = e.target.closest('.member');

  if (!memberElement) {
    return;
  };

  const memberIdString: string | null = memberElement.getAttribute('data-memberId');

  if (!memberIdString || !Number.isInteger(+memberIdString)) {
    return;
  };

  const hangoutMemberId: number = +memberIdString;
  const hangoutMemberDisplayName: string | undefined = globalHangoutState.data.hangoutMembersDisplayNameMap.get(hangoutMemberId);

  if (!hangoutMemberDisplayName) {
    popup('Hangout member not found.', 'error');
    renderMembersContainer();

    return;
  };

  if (e.target.className === 'transfer-leadership-btn') {

    confirmMemberAction(
      `Are you sure you want to transfer the hangout leadership to ${hangoutMemberDisplayName}?`,
      transferHangoutLeadership,
      [hangoutMemberId]
    );

    return;
  };

  if (e.target.className === 'kick-member-btn') {
    confirmMemberAction(
      `Are you sure you want to kick ${hangoutMemberDisplayName} from the hangout?`,
      kickHangoutMember,
      [hangoutMemberId]
    );

    return;
  };

  if (e.target.className === 'relinquish-leadership-btn') {
    confirmMemberAction(
      `Are you sure you want to relinquish the hangout leadership?`,
      relinquishHangoutLeadership,
      []
    );

    return;
  };

  if (e.target.className === 'add-friend-btn') {
    if (globalHangoutState.data.hangoutMembersFriendsSet.has(hangoutMemberId)) {
      popup(`Already friends with ${hangoutMemberDisplayName}.`, 'success');
      renderMembersContainer();

      return;
    };

    const hangoutMember: HangoutMember | undefined = globalHangoutState.data.hangoutMembers.find((member: HangoutMember) => member.hangout_member_id === hangoutMemberId);

    if (!hangoutMember) {
      popup('Hangout member not found.', 'error');
      renderMembersContainer();

      return;
    };

    if (hangoutMember.user_type == 'guest') {
      popup(`Can't send friend requests to guest users.`, 'error');
      renderMembersContainer();

      return;
    };

    await sendFriendRequest(hangoutMember.username);
    e.target.parentElement?.parentElement?.classList.remove('expanded');
  };
};

async function transferHangoutLeadership(newLeaderMemberId: number): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong/', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, isLeader, hangoutDetails, hangoutMembersDisplayNameMap: hangoutMembersMap, hangoutMembers } = globalHangoutState.data;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (newLeaderMemberId === hangoutMemberId) {
    popup(`You're already the hangout leader.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (!hangoutMembersMap.has(newLeaderMemberId)) {
    removeHangoutMemberData(newLeaderMemberId);
    renderMembersSection();

    popup('Hangout member not found.', 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await transferHangoutLeadershipService({ hangoutId, hangoutMemberId, newLeaderMemberId });

    globalHangoutState.data.isLeader = false;
    for (const member of hangoutMembers) {
      if (member.hangout_member_id === hangoutMemberId) {
        member.is_leader = false;
        continue;
      };

      if (member.hangout_member_id === newLeaderMemberId) {
        member.is_leader = true;
      };
    };

    updateHangoutSettingsNavButtons();
    renderMembersSection();

    popup('Hangout leadership transferred.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 409 && errReason === 'hangoutConcluded') {
      globalHangoutState.data.hangoutDetails.is_concluded = true;
      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;

      renderMembersSection();
      return;
    };

    if (status === 404) {
      if (errReason === 'memberNotFound') {
        removeHangoutMemberData(newLeaderMemberId);
        renderMembersSection();

        return;
      };

      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (status === 401) {
      if (errReason === 'notHangoutLeader') {
        globalHangoutState.data.isLeader = false;
        renderMembersSection();

        return;
      };

      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
    };
  };
};

async function kickHangoutMember(memberToKickId: number): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong/', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, isLeader, hangoutMembersDisplayNameMap: hangoutMembersMap } = globalHangoutState.data;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (memberToKickId === hangoutMemberId) {
    popup(`You can't kick yourself.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (!hangoutMembersMap.has(memberToKickId)) {
    removeHangoutMemberData(memberToKickId);
    renderMembersSection();

    popup('Hangout member kicked.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await kickHangoutMemberService(hangoutId, hangoutMemberId, memberToKickId);

    removeHangoutMemberData(memberToKickId);
    updateHangoutSettingsNavButtons();
    renderMembersSection();

    popup('Hangout member kicked.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
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
      if (errReason === 'notHangoutLeader') {
        globalHangoutState.data.isLeader = false;
        renderMembersSection();

        return;
      };

      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
    };
  };
};

async function relinquishHangoutLeadership(): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong/', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, isLeader, hangoutDetails, hangoutMembers } = globalHangoutState.data;

  if (!isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await relinquishHangoutLeadershipService({ hangoutId, hangoutMemberId });

    const hangoutMember: HangoutMember | undefined = hangoutMembers.find((member: HangoutMember) => member.hangout_member_id === hangoutMemberId);

    hangoutMember && (hangoutMember.is_leader = false);
    globalHangoutState.data.isLeader = false;
    hangoutMembersState.hasLeader = false;

    updateHangoutSettingsNavButtons();
    renderMembersSection();

    popup('Hangout leadership relinquished.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 409) {
      globalHangoutState.data.hangoutDetails.is_concluded = true;
      globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;

      renderMembersSection();
      return;
    };

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
      if (errReason === 'notHangoutLeader') {
        globalHangoutState.data.isLeader = false;
        renderMembersSection();

        return;
      };

      handleAuthSessionExpired();
    };
  };
};

async function claimHangoutLeadership(): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong/', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, hangoutDetails, hangoutMembers } = globalHangoutState.data;

  if (hangoutHasLeader()) {
    popup(`Hangout already has a leader.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await claimHangoutLeadershipService({ hangoutId, hangoutMemberId });

    const hangoutMember: HangoutMember | undefined = hangoutMembers.find((member: HangoutMember) => member.hangout_member_id === hangoutMemberId);

    hangoutMember && (hangoutMember.is_leader = true);
    globalHangoutState.data.isLeader = true;
    hangoutMembersState.hasLeader = true;

    updateHangoutSettingsNavButtons();
    renderMembersSection();

    popup('Hangout leadership claimed.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason, errResData } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 409) {
      if (errReason === 'hangoutConcluded') {
        globalHangoutState.data.hangoutDetails.is_concluded = true;
        globalHangoutState.data.hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;

        return;
      };

      if (errReason === 'hangoutHasLeader') {
        handleHangoutAlreadyHasLeader(errResData, hangoutMemberId);
      };

      return;
    };

    if (status === 404) {
      LoadingModal.remove();
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

async function sendFriendRequest(requesteeUsername: string): Promise<void> {
  LoadingModal.display();

  if (Cookies.get('signedInAs') === 'guest') {
    renderMembersContainer();

    popup(`Can't send friend requests as a guest user.`, 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await sendFriendRequestService({ requesteeUsername });

    popup('Friend request sent.', 'success');
    LoadingModal.remove();

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

    if (status === 409 && errReason === 'alreadySent') {
      popup(errMessage, 'success');
      return;
    };

    popup(errMessage, 'error');

    if (status === 404) {
      renderMembersContainer();
      return;
    };

    if (status === 401) {
      handleAuthSessionExpired();
    };
  };
};

function confirmMemberAction<T extends (...args: any[]) => Promise<void>>(confirmationString: string, func: T, args: Parameters<T>): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: null,
    description: confirmationString,
    confirmBtnTitle: 'Confirm',
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
      await func(...args);

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};

export function removeHangoutMemberData(hangoutMemberId: number): void {
  if (!globalHangoutState.data) {
    return;
  };

  globalHangoutState.data.hangoutMembersDisplayNameMap.delete(hangoutMemberId);
  globalHangoutState.data.hangoutMembers = globalHangoutState.data.hangoutMembers.filter((member: HangoutMember) => member.hangout_member_id !== hangoutMemberId);

  hangoutMembersState.filteredMembers = hangoutMembersState.filteredMembers.filter((member: HangoutMember) => member.hangout_member_id !== hangoutMemberId);
};

function hangoutHasLeader(): boolean {
  return globalHangoutState.data?.hangoutMembers.some((member: HangoutMember) => member.is_leader) === true;
};

function handleHangoutAlreadyHasLeader(errResData: unknown, hangoutMemberId: number): void {
  if (!globalHangoutState.data) {
    return;
  };

  if (typeof errResData !== 'object' || errResData === null) {
    return;
  };

  if (!('leaderMemberId' in errResData) || typeof errResData.leaderMemberId !== 'number') {
    return;
  };

  if (!Number.isInteger(errResData.leaderMemberId)) {
    return;
  };

  const hangoutLeader: HangoutMember | undefined = globalHangoutState.data.hangoutMembers.find((member: HangoutMember) => member.hangout_member_id === errResData.leaderMemberId);

  if (!hangoutLeader) {
    return;
  };

  hangoutLeader.is_leader = true;

  if (errResData.leaderMemberId === hangoutMemberId) {
    globalHangoutState.data.isLeader = true;
  };

  hangoutMembersState.hasLeader = true;
  renderMembersSection();
};

const debounceMembersSearch = debounce(searchHangoutMembers, 300);

export function searchHangoutMembers(): void {
  if (!globalHangoutState.data || !membersSearchInput) {
    return;
  };

  const searchQuery: string = membersSearchInput.value;
  hangoutMembersState.filteredMembers = globalHangoutState.data.hangoutMembers.filter((member: HangoutMember) => member.display_name.toLowerCase().includes(searchQuery.toLowerCase()));

  renderMembersContainer();
};

function initMembersSectionMutationObserver(): void {
  if (!membersSection) {
    return;
  };

  const mutationObserver: MutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class' && membersSection.classList.contains('hidden')) {
        if (!globalHangoutState.data || !membersSection) {
          return;
        };

        hangoutMembersState.filteredMembers = [...globalHangoutState.data.hangoutMembers];
        hangoutMembersState.membersSectionMutationObserverActive = false;
        membersSearchInput && (membersSearchInput.value = '');

        mutationObserver.disconnect();
        break;
      };
    };
  });

  mutationObserver.observe(membersSection, { attributes: true, attributeFilter: ['class'] });
  hangoutMembersState.membersSectionMutationObserverActive = true;
};