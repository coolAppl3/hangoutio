import axios, { AxiosError, AxiosResponse } from "../../../../../node_modules/axios/index";
import { ConfirmModal } from "../../global/ConfirmModal";
import Cookies from "../../global/Cookies";
import { InfoModal } from "../../global/InfoModal";
import popup from "../../global/popup";
import { isValidHangoutId } from "../../global/validation";
import { getHangoutDashboardDataService, getHangoutExistsService, HangoutDashboardData, HangoutExistsData } from "../../services/hangoutServices";
import { initHangoutGuestSignUp } from "./initHangoutGuestSignUp";

const hangoutDashboardElement: HTMLElement | null = document.querySelector('#dashboard-section');

export function hangoutDashboard(): void {
  init();
  loadEventListeners();
};

function init(): void {
  getHangoutDashboardData();
};

function loadEventListeners(): void {

};

export async function getHangoutDashboardData(): Promise<void> {
  const url = new URL(window.location.href);
  const hangoutId: string | null = url.searchParams.get('hangoutId');

  if (!hangoutId || !isValidHangoutId(hangoutId)) {
    handleInvalidHangoutId();
    return;
  };

  const authToken: string | null = Cookies.get('authToken');
  if (!authToken || !isValidHangoutId(hangoutId)) {
    await handleNoAuthToken(hangoutId);
    return;
  };

  removeGuestSignUpSection();

  // TODO: continue implementation:
};

function handleInvalidHangoutId(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Invalid hangout Link.',
    description: `The link you've entered contains an invalid hangout ID.\nRequest a valid link from the hangout leader.`,
    btnTitle: 'Okay',
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

async function handleNoAuthToken(hangoutId: string): Promise<void> {
  let isPasswordProtected: boolean = false;
  let isFull: boolean = false

  try {
    const hangoutExistsData: AxiosResponse<HangoutExistsData> = await getHangoutExistsService(hangoutId);
    isPasswordProtected = hangoutExistsData.data.resData.isPasswordProtected;
    isFull = hangoutExistsData.data.resData.isFull;

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

    if (status === 400) {
      handleInvalidHangoutId();
      return;
    };

    if (status === 404) {
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

      return;
    };

    popup(errMessage, 'error');
    setTimeout(() => window.location.href = 'index.html');

    return;
  };

  if (!isPasswordProtected && isFull) {
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
      };
    });

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

    // once done, move on to the guest sign up section in the hangout.html. Create a seperate modal for it
    // DONT FORGET: if the guest sign up modal is not needed, or gets used successfully, YOU MUST REMOVE IT TO REDUCE PERFORMANCE STRAIN

    if (e.target.id === 'confirm-modal-confirm-btn') {
      sessionStorage.setItem('pendingSignInHangoutId', hangoutId);
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

      return;
    };
  });
};

function removeGuestSignUpSection(): void {
  const guestSignUpSection: HTMLElement | null = document.querySelector('#guest-sign-up-section');
  const hangoutLoadingSkeleton: HTMLDivElement | null = document.querySelector('#hangout-loading-skeleton');

  guestSignUpSection?.remove();
  hangoutLoadingSkeleton?.classList.remove('hidden');
};

function hideLoadingSkeleton(): void {
  const hangoutDesktopNav: HTMLElement | null = document.querySelector('#hangout-desktop-nav');
  const hangoutLoadingSkeleton: HTMLDivElement | null = document.querySelector('#hangout-loading-skeleton');

  hangoutDesktopNav?.parentElement?.parentElement?.classList.remove('hidden');
  hangoutDashboardElement?.classList.remove('hidden');
  hangoutLoadingSkeleton?.remove();

  window.scroll({ top: 0, behavior: 'smooth' });
};