import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { ConfirmModal } from "../../global/ConfirmModal";
import Cookies from "../../global/Cookies";
import ErrorSpan from "../../global/ErrorSpan";
import { InfoModal } from "../../global/InfoModal";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { JoinHangoutAsAccountBody, joinHangoutAsAccountService } from "../../services/hangoutMemberServices";
import { getHangoutDashboardData } from "./hangoutDashboard";
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
    description: `It looks like you haven't accessed this hangout before.\nWould you like to join?`,
    confirmBtnTitle: 'Join hangout',
    cancelBtnTitle: 'Go to my account',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      confirmModal.remove();
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

    await getHangoutDashboardData();

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status == 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired(window.location.href);
        return;
      };

      if (errReason === 'authSessionDestroyed') {
        handleAuthSessionDestroyed(window.location.href);
        return;
      };

      if (errReason === 'hangoutPassword') {
        joinHangoutPasswordInput && ErrorSpan.display(joinHangoutPasswordInput, errMessage);
      };

      return;
    };

    if (status === 403) {
      handleGuestNotMember();
      return;
    };

    if (status === 409) {
      if (errReason === 'hangoutsLimitReached') {
        handleHangoutsLimitReached(errMessage);
        return;
      };

      if (errReason === 'hangoutFull') {
        handleHangoutFull();
        return;
      };

      if (errReason === 'alreadyJoined') {
        setTimeout(() => window.location.reload(), 1000);
      };

      return;
    };

    if (status === 404) {
      handleHangoutNotFound();
      return;
    };

    if (status === 400) {
      if (errReason === 'invalidHangoutId') {
        handleInvalidHangoutId();
        return;
      };

      if (errReason === 'invalidHangoutPassword') {
        joinHangoutPasswordInput && ErrorSpan.display(joinHangoutPasswordInput, errMessage);
      };

      return;
    };

    setTimeout(() => window.location.reload(), 1000);
  };
};

interface ValidNotHangoutMemberErrResData {
  isPasswordProtected: boolean,
  isFull: boolean | null,
};

function isValidNotHangoutMemberData(errResData: unknown): errResData is ValidNotHangoutMemberErrResData {
  if (typeof errResData !== 'object' || errResData === null) {
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
    if (!(e.target instanceof HTMLElement)) {
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
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'account';
    };
  });
};