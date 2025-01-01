import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_AVAILABILITY_SLOTS_LIMIT } from "../../global/clientConstants";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { getHangoutAvailabilitySlotsServices } from "../../services/availabilitySlotsServices";
import { DateTimePickerData, displayDateTimePicker, isValidDateTimePickerEvent } from "../dateTimePicker";
import { globalHangoutState } from "../globalHangoutState";
import { AvailabilitySlot } from "../hangoutTypes";
import { initAvailabilityCalendar } from "./availabilityCalendar";
import { createAvailabilitySlotElement } from "./availabilityUtils";

interface HangoutAvailabilityState {
  isLoaded: boolean,
  availabilitySlots: AvailabilitySlot[],
};

export const hangoutAvailabilityState: HangoutAvailabilityState = {
  isLoaded: false,
  availabilitySlots: [],
};

const addAvailabilityBtn: HTMLButtonElement | null = document.querySelector('#add-availability-btn');

export function hangoutAvailability(): void {
  loadEventListeners();
};

async function init(): Promise<void> {
  if (!globalHangoutState.data) {
    return;
  };

  await getHangoutAvailabilitySlots();
  render();
};

function render(): void {
  initAvailabilityCalendar();
  displayPersonalAvailabilitySlots();
  updateSlotsRemaining();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-availability', init);

  addAvailabilityBtn?.addEventListener('click', () => displayDateTimePicker('availabilitySlot'));
  document.addEventListener('dateTimePicker-availabilitySlot-selected', async (e: Event) => {
    if (!isValidDateTimePickerEvent(e)) {
      return;
    };

    const dateTimePickerData: DateTimePickerData = e.detail;
    await addHangoutAvailabilitySlot(dateTimePickerData);
  });
};

async function getHangoutAvailabilitySlots(): Promise<void> {
  if (hangoutAvailabilityState.isLoaded) {
    return;
  };

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
    hangoutAvailabilityState.isLoaded = true;

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

async function addHangoutAvailabilitySlot(dateTimePickerData: DateTimePickerData): Promise<void> {
  // TODO: implement
};

function displayPersonalAvailabilitySlots(): void {
  if (hangoutAvailabilityState.availabilitySlots.length === 0) {
    return;
  };

  const availabilitySlotsElement: HTMLDivElement | null = document.querySelector('#availability-slots');
  const availabilitySlotsContainer: HTMLDivElement | null = document.querySelector('#availability-slots-container');

  if (!availabilitySlotsElement || !availabilitySlotsContainer) {
    popup('Failed to load your availability slots.', 'error');
    return;
  };

  const innerContainer: HTMLDivElement = document.createElement('div');

  for (const slot of hangoutAvailabilityState.availabilitySlots) {
    innerContainer.appendChild(createAvailabilitySlotElement(slot));
  };

  availabilitySlotsContainer.firstElementChild?.remove();
  availabilitySlotsContainer.appendChild(innerContainer);

  availabilitySlotsElement.classList.remove('hidden');
};

function updateSlotsRemaining(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const availabilitySlotsCount: number = globalHangoutState.data.availabilitySlotsCount;
  const slotsRemaining: number = HANGOUT_AVAILABILITY_SLOTS_LIMIT - availabilitySlotsCount;

  const slotsRemainingSpan: HTMLSpanElement | null = document.querySelector('#availability-section-slots-remaining');
  slotsRemainingSpan && (slotsRemainingSpan.textContent = `${slotsRemaining}.`);
};