import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { ConfirmModal } from "../../global/ConfirmModal";
import Cookies from "../../global/Cookies";
import ErrorSpan from "../../global/ErrorSpan";
import { InfoModal } from "../../global/InfoModal";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { isValidAuthToken } from "../../global/validation";
import { JoinHangoutAsAccountBody, joinHangoutAsAccountService } from "../../services/hangoutServices";
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

export async function handleNotHangoutMember(errResData: unknown, hangoutId: string): Promise<void> {
  if (!isValidNotHangoutMemberData(errResData)) {
    popup('Something went wrong.', 'error');
    setTimeout(() => window.location.href = 'index.html', 1000);

    return;
  };

  notHangoutMemberState = {
    hangoutId,
    isPasswordProtected: errResData.isPasswordProtected,
    isFull: errResData.isFull,
  };

  const authToken: string | null = Cookies.get('authToken');
  if (!authToken || !isValidAuthToken(authToken)) {
    Cookies.remove('authToken');
    popup('Invalid credentials detected.', 'error');

    await getHangoutDashboardData();
    return;
  };

  const isGuestUser: boolean = authToken.startsWith('g');
  if (isGuestUser) {
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
      await joinHangoutAsAccount();
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'account.html';
    };
  });
};

export async function joinHangoutAsAccount(): Promise<void> {
  LoadingModal.display();

  if (!notHangoutMemberState) {
    popup('Something went wrong.', 'error');
    setTimeout(() => window.location.href = 'index.html', 1000);

    return;
  };

  const authToken: string | null = Cookies.get('authToken');
  if (!authToken || !isValidAuthToken(authToken)) {
    Cookies.remove('authToken');
    popup('Not signed in.', 'error');
    setTimeout(() => window.location.href = 'sign-in.html', 1000);

    return;
  };

  const joinHangoutPasswordInput: HTMLInputElement | null = document.querySelector('#join-hangout-password-input');
  const hangoutPassword: string | null = joinHangoutPasswordInput ? joinHangoutPasswordInput.value : null;

  const joinHangoutAsAccountBody: JoinHangoutAsAccountBody = {
    hangoutId: notHangoutMemberState.hangoutId,
    hangoutPassword,
  };

  try {
    await joinHangoutAsAccountService(authToken, joinHangoutAsAccountBody);

    popup('Successfully joined hangout.', 'success');
    removeJoinHangoutForm();
    LoadingModal.remove();

    await getHangoutDashboardData();

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.href = 'index.html', 1000);

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.href = 'index.html', 1000);

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status == 401) {
      if (errReason === 'hangoutPassword') {
        joinHangoutPasswordInput ? ErrorSpan.display(joinHangoutPasswordInput, errMessage) : undefined;
        return;
      };

      Cookies.remove('authToken');
      setTimeout(() => window.location.href = 'sign-in.html', 1000);

      return;
    };

    if (status === 400) {
      if (errReason === 'hangoutId') {
        handleInvalidHangoutId();
        return;
      };

      if (errReason === 'hangoutPassword') {
        joinHangoutPasswordInput ? ErrorSpan.display(joinHangoutPasswordInput, errMessage) : undefined;
        return;
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

      return;
    };

    if (status === 404) {
      handleHangoutNotFound();
      return;
    };

    setTimeout(() => window.location.href = 'index.html', 1000);
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
    title: `You're not a member of this hangout.`,
    description: 'This is not the hangout linked to your guest account.\nGuest accounts can only access the hangout they were created for.',
    confirmBtnTitle: 'Create a new guest account',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      if (!notHangoutMemberState) {
        popup('Something went wrong.', 'error');
        setTimeout(() => window.location.href = 'index.html', 1000);

        return;
      };

      Cookies.remove('authToken');
      popup('Signed out.', 'success');

      initHangoutGuestSignUp(notHangoutMemberState.hangoutId, notHangoutMemberState.isPasswordProtected);
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'index.html';
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
      window.location.href = 'account.html';
    };
  });
};