import axios, { AxiosError, AxiosResponse } from "../../../../../node_modules/axios/index";
import Cookies from "../../global/Cookies";
import { handleAuthSessionExpired } from "../../global/authUtils";
import popup from "../../global/popup";
import { isValidHangoutId } from "../../global/validation";
import { getHangoutDashboardDataService, HangoutDashboardData } from "../../services/hangoutServices";
import { handleNotHangoutMember } from "./handleNotHangoutMember";
import { handleHangoutNotFound, handleInvalidHangoutId, handleNotSignedIn, hideLoadingSkeleton, removeGuestSignUpSection } from "./hangoutDashboardUtils";

const hangoutDashboardElement: HTMLElement | null = document.querySelector('#dashboard-section');

interface HangoutDashboardState {

};

export async function hangoutDashboard(): Promise<void> {
  await init();
  loadEventListeners();
};

async function init(): Promise<void> {
  await getHangoutDashboardData();
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

  const signedInAs: string | null = Cookies.get('signedInAs');
  if (!signedInAs) {
    await handleNotSignedIn(hangoutId);
    return;
  };

  try {
    const hangoutDashboardData: AxiosResponse<HangoutDashboardData> = await getHangoutDashboardDataService(hangoutId);
    console.log(hangoutDashboardData)

    // removeGuestSignUpSection(); 
    // hideLoadingSkeleton();


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