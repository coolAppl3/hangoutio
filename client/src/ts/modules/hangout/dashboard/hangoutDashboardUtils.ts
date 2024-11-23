import axios, { AxiosError, AxiosResponse } from "../../../../../node_modules/axios/index";
import { ConfirmModal } from "../../global/ConfirmModal";
import Cookies from "../../global/Cookies";
import { InfoModal } from "../../global/InfoModal";
import popup from "../../global/popup";
import { signOut } from "../../global/signOut";
import { isValidAuthToken, isValidHangoutId } from "../../global/validation";
import { getHangoutExistsService, HangoutExistsData } from "../../services/hangoutServices";
import { initHangoutGuestSignUp } from "./initHangoutGuestSignUp";

export function handleInvalidHangoutId(): void {
  const authToken: string | null = Cookies.get('authToken');

  if (authToken && isValidAuthToken(authToken) && authToken.startsWith('g')) {
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
      window.location.href = 'index.html';
    };
  });
};

function handleEmptyHangoutGuestRequest(): void {
  const guestHangoutId: string | null = Cookies.get('guestHangoutId');

  if (!guestHangoutId || !isValidHangoutId(guestHangoutId)) {
    signOut();
    handleInvalidHangoutId();

    return;
  };

  window.location.href = `${window.location.origin}/hangout.html?hangoutId=${guestHangoutId}`;
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
      window.location.href = 'index.html';
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
      window.location.href = 'index.html';
      return;
    };
  });
};

export async function handleNoAuthToken(hangoutId: string): Promise<void> {
  let isPasswordProtected: boolean = false;

  try {
    const hangoutExistsData: AxiosResponse<HangoutExistsData> = await getHangoutExistsService(hangoutId);
    isPasswordProtected = hangoutExistsData.data.resData.isPasswordProtected;

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

    popup(errMessage, 'error');

    if (status === 404) {
      handleHangoutNotFound();
      return;
    };

    if (status === 400) {
      handleInvalidHangoutId();
      return;
    };

    setTimeout(() => window.location.href = 'index.html', 1000);
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
      window.location.href = 'sign-in.html';

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'index.html';
      return;
    };

    if (e.target.id === 'confirm-modal-other-btn') {
      confirmModal.remove();
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

export function hideLoadingSkeleton(): void {
  const hangoutDesktopNav: HTMLElement | null = document.querySelector('#hangout-desktop-nav');
  const hangoutDashboardElement: HTMLElement | null = document.querySelector('#dashboard-section');
  const hangoutLoadingSkeleton: HTMLDivElement | null = document.querySelector('#hangout-loading-skeleton');

  hangoutDesktopNav?.parentElement?.parentElement?.classList.remove('hidden');
  hangoutDashboardElement?.classList.remove('hidden');
  hangoutLoadingSkeleton?.remove();

  window.scroll({ top: 0, behavior: 'smooth' });
};