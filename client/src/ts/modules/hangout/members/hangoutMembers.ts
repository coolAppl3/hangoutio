import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { ConfirmModal } from "../../global/ConfirmModal";
import { createDivElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { kickHangoutMemberService, transferHangoutLeadershipService } from "../../services/hangoutMemberServices";
import { globalHangoutState } from "../globalHangoutState";
import { HangoutMember } from "../hangoutTypes";
import { hangoutSuggestionState } from "../suggestions/hangoutSuggestions";
import { createMemberElement } from "./membersUtils";

interface HangoutMembersState {
  changesToRender: boolean,
};

const hangoutMembersState: HangoutMembersState = {
  changesToRender: true,
};

const membersContainer: HTMLDivElement | null = document.querySelector('#members-container');

export function hangoutMembers(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-members', renderMembersSection);

  membersContainer?.addEventListener('click', handleMembersContainerClicks);
};

function renderMembersSection(): void {
  if (!hangoutMembersState.changesToRender) {
    return;
  };

  renderMembersContainer();
  hangoutMembersState.changesToRender = false;
};

function renderMembersContainer(): void {
  if (!globalHangoutState.data || !membersContainer) {
    popup('Failed to load hangout members.', 'error');
    return;
  };

  const { isLeader, hangoutMembers } = globalHangoutState.data;
  const innerMembersContainer: HTMLDivElement = createDivElement(null, 'members-container-inner');

  for (const member of hangoutMembers) {
    innerMembersContainer.appendChild(createMemberElement(member, isLeader));
  };

  membersContainer.firstElementChild?.remove();
  membersContainer.appendChild(innerMembersContainer);
};

function handleMembersContainerClicks(e: MouseEvent): void {
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
  const hangoutMemberDisplayName: string | undefined = globalHangoutState.data.hangoutMembersMap.get(hangoutMemberId);

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

  if (e.target.className === 'waive-leadership-btn') {
    confirmMemberAction(
      `Are you sure you want to waive the hangout leadership?`,
      waiveHangoutLeadership,
      []
    );

    return;
  };
};

async function transferHangoutLeadership(newLeaderMemberId: number): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong/', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, isLeader, hangoutDetails, hangoutMembersMap, hangoutMembers } = globalHangoutState.data;

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

    const newHangoutLeader: HangoutMember | undefined = hangoutMembers.find((member: HangoutMember) => member.hangout_member_id === newLeaderMemberId);

    newHangoutLeader && (newHangoutLeader.is_leader = true);
    globalHangoutState.data.isLeader = false;

    renderMembersSection();

    popup('Hangout leadership transferred.', 'error');
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
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

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

  const { hangoutId, hangoutMemberId, isLeader, hangoutDetails, hangoutMembersMap, hangoutMembers } = globalHangoutState.data;

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

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await kickHangoutMemberService(hangoutId, hangoutMemberId, memberToKickId);

    removeHangoutMemberData(memberToKickId);
    renderMembersSection();

    popup('Hangout member kicked.', 'error');
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
    const errReason: string | undefined = axiosError.response.data.reason;

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

async function waiveHangoutLeadership(): Promise<void> {
  // TODO: implement
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
      await func(...args);
      ConfirmModal.remove();

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};

function removeHangoutMemberData(hangoutMemberId: number): void {
  if (!globalHangoutState.data) {
    return;
  };

  globalHangoutState.data.hangoutMembersMap.delete(hangoutMemberId);
  globalHangoutState.data.hangoutMembers = globalHangoutState.data.hangoutMembers.filter((member: HangoutMember) => member.hangout_member_id !== hangoutMemberId);
};