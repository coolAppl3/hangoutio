import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { ConfirmModal } from "../../global/ConfirmModal";
import Cookies from "../../global/Cookies";
import ErrorSpan from "../../global/ErrorSpan";
import { AsyncErrorData, getAsyncErrorData } from "../../global/errorUtils";
import { InfoModal } from "../../global/InfoModal";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { JoinHangoutAsAccountBody, joinHangoutAsAccountService } from "../../services/hangoutMemberServices";
import { getInitialHangoutData } from "./hangoutDashboard";
import { handleHangoutFull, handleHangoutNotFound, handleInvalidHangoutId } from "./hangoutDashboardUtils";
import { initHangoutGuestSignUp } from "./initHangoutGuestSignUp";
import { initJoinHangoutForm, removeJoinHangoutForm } from "./initJoinHangoutForm";

interface NotHangoutMemberState {
  hangoutId: string,
  isPasswordProtected: boolean,
  isFull: boolean | null,
};

let notHangoutMemberState: NotHangoutMemberState | null = null;

export function handleNotHangoutMember(errResData: unknown, hangoutId: string): void {
  if (!isValidNotHangoutMemberData(errResData)) {
    popup('Something went wrong.', 'error');
    setTimeout(() => window.location.href = 'home', 1000);

    return;
  };

  notHangoutMemberState = {
    hangoutId,
    isPasswordProtected: errResData.isPasswordProtected,
    isFull: errResData.isFull,
  };

  const signedInAs: string | null = Cookies.get('signedInAs');
  if (signedInAs === 'guest') {
    handleGuestNotMember();
    return;
  };

  if (errResData.isPasswordProtected) {
    initJoinHangoutForm();
    return;
  };

  if (errResData.isFull) {
    handleHangoutFull();
    return;
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Confirm access.',
    description: `It looks like you're not a member of this hangout.\nWould you like to join?`,
    confirmBtnTitle: 'Join hangout',
    cancelBtnTitle: 'Go to my account',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      ConfirmModal.remove();
      await joinHangoutAsAccount();

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'account';
    };
  });
};

export async function joinHangoutAsAccount(): Promise<void> {
  LoadingModal.display();

  if (!notHangoutMemberState) {
    popup('Something went wrong.', 'error');
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  const joinHangoutPasswordInput: HTMLInputElement | null = document.querySelector('#join-hangout-password-input');
  const hangoutPassword: string | null = joinHangoutPasswordInput ? joinHangoutPasswordInput.value : null;

  const joinHangoutAsAccountBody: JoinHangoutAsAccountBody = {
    hangoutId: notHangoutMemberState.hangoutId,
    hangoutPassword,
  };

  try {
    await joinHangoutAsAccountService(joinHangoutAsAccountBody);
    removeJoinHangoutForm();

    popup('Successfully joined hangout.', 'success');
    LoadingModal.remove();

    await getInitialHangoutData();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    popup(errMessage, 'error');

    if (status == 401) {
      if (errReason === 'hangoutPassword') {
        joinHangoutPasswordInput && ErrorSpan.display(joinHangoutPasswordInput, errMessage);
        return;
      };

      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
      return;
    };

    if (status === 403) {
      handleGuestNotMember();
      return;
    };

    if (status === 409) {
      if (errReason === 'alreadyJoined') {
        LoadingModal.display();
        setTimeout(() => window.location.reload(), 1000);

        return;
      };

      if (errReason === 'hangoutsLimitReached') {
        handleHangoutsLimitReached(errMessage);
        return;
      };

      handleHangoutFull();
      return;
    };

    if (status === 404) {
      handleHangoutNotFound();
      return;
    };

    if (status === 400) {
      if (errReason === 'invalidHangoutPassword') {
        joinHangoutPasswordInput && ErrorSpan.display(joinHangoutPasswordInput, errMessage);
        return;
      };

      handleInvalidHangoutId();
    };
  };
};

interface ValidNotHangoutMemberErrResData {
  isConcluded: boolean,
  isPasswordProtected: boolean,
  isFull: boolean | null,
};

function isValidNotHangoutMemberData(errResData: unknown): errResData is ValidNotHangoutMemberErrResData {
  if (typeof errResData !== 'object' || errResData === null) {
    return false;
  };

  if (!('isConcluded' in errResData) || typeof errResData.isConcluded !== 'boolean') {
    return false;
  };

  if (!('isPasswordProtected' in errResData) || typeof errResData.isPasswordProtected !== 'boolean') {
    return false;
  };

  if (!('isFull' in errResData)) {
    return false;
  };

  if (typeof errResData.isFull !== 'boolean' && errResData.isFull !== null) {
    return false;
  };

  return true;
};

function handleGuestNotMember(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: `You're signed in as a guest.`,
    description: 'This is not the hangout linked to your guest account.\nGuest accounts can only access the hangout they were created for.',
    confirmBtnTitle: 'Create a new guest account',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      if (!notHangoutMemberState) {
        popup('Something went wrong.', 'error');
        setTimeout(() => window.location.href = 'home', 1000);

        return;
      };

      initHangoutGuestSignUp(notHangoutMemberState.hangoutId, notHangoutMemberState.isPasswordProtected);
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'home';
    };
  });
};

function handleHangoutsLimitReached(errMessage: string): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: errMessage,
    description: `To create or join a new hangout, wait for one of your current hangouts to conclude or leave one to make room.`,
    btnTitle: 'Go to my account',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'account';
    };
  });
};