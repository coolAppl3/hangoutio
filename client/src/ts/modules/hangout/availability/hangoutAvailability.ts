import axios, { AxiosError, AxiosResponse } from "../../../../../node_modules/axios/index";
import { handleAuthSessionExpired } from "../../global/authUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { getHangoutAvailabilitySlotsServices } from "../../services/availabilitySlotsServices";
import { globalHangoutState } from "../globalHangoutState";
import { AvailabilitySlot, HangoutsDetails } from "../hangoutDataTypes";
import { initAvailabilityCalendar } from "./availabilityCalendar";

interface HangoutAvailabilityState {
  loaded: boolean,
  availabilitySlots: AvailabilitySlot[],
};

export const hangoutAvailabilityState: HangoutAvailabilityState = {
  loaded: false,
  availabilitySlots: [],
};

export function hangoutAvailability(): void {
  loadEventListeners();
};

async function init(): Promise<void> {
  if (!globalHangoutState.data) {
    return;
  };

  const { created_on_timestamp, availability_period, suggestions_period, voting_period } = globalHangoutState.data.hangoutDetails;
  const hangoutConclusionTimestamp: number = created_on_timestamp + availability_period + suggestions_period + voting_period;

  await getHangoutAvailabilitySlots();
  initAvailabilityCalendar(hangoutConclusionTimestamp);
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-availability', init);
};

async function getHangoutAvailabilitySlots(): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    const { hangoutId, hangoutMemberId } = globalHangoutState.data;
    const availabilitySlots: AvailabilitySlot[] = (await getHangoutAvailabilitySlotsServices(hangoutId, hangoutMemberId)).data.availabilitySlots;

    hangoutAvailabilityState.availabilitySlots = availabilitySlots;
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

    popup(errMessage, 'error');

    if (status === 401) {
      handleAuthSessionExpired(window.location.href);
      return;
    };

    if (status === 401) {
      setTimeout(() => {
        sessionStorage.removeItem('latestHangoutSection');

        LoadingModal.display();
        window.location.href = 'home';
      }, 1000);
    };
  };
};