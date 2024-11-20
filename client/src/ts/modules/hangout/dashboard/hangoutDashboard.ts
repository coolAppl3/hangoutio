import axios, { AxiosError, AxiosResponse } from "../../../../../node_modules/axios/index";
import Cookies from "../../global/Cookies";
import popup from "../../global/popup";
import { isValidHangoutId } from "../../global/validation";
import { getHangoutDashboardDataService, HangoutDashboardData } from "../../services/hangoutServices";
import { handleNotHangoutMember } from "./handleNotHangoutMember";
import { handleHangoutFull, handleInvalidHangoutId, handleNoAuthToken, hideLoadingSkeleton, removeGuestSignUpSection } from "./hangoutDashboardUtils";

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

  const authToken: string | null = Cookies.get('authToken');
  if (!authToken || !isValidHangoutId(hangoutId)) {
    await handleNoAuthToken(hangoutId);
    return;
  };

  try {
    const hangoutDashboardData: AxiosResponse<HangoutDashboardData> = await getHangoutDashboardDataService(authToken, hangoutId);
    console.log(hangoutDashboardData)

    // removeGuestSignUpSection(); 
    // hideLoadingSkeleton();


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
    const errResData: unknown = axiosError.response.data.resData;

    if (status === 401) {
      if (errReason === 'notMember') {
        await handleNotHangoutMember(errResData, hangoutId);
        return;
      };

      Cookies.remove('authToken');

      popup(errMessage, 'error');
      setTimeout(() => window.location.href = 'index.html', 1000);

      return;
    };

    if (status === 400 && errReason === 'hangoutId') {
      handleInvalidHangoutId();
      return;
    };

    if (status === 404) {
      handleHangoutFull();
      return;
    };

    popup(errMessage, 'error');
    setTimeout(() => window.location.href = 'index.html', 1000);
  };
};