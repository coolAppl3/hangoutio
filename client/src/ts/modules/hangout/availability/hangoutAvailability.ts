import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_AVAILABILITY_SLOTS_LIMIT } from "../../global/clientConstants";
import { InfoModal } from "../../global/InfoModal";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { AddHangoutAvailabilitySlotBody, addHangoutAvailabilitySlotService, getHangoutAvailabilitySlotsService } from "../../services/availabilitySlotsServices";
import { closeDateTimePicker, DateTimePickerData, displayDateTimePicker, displayTimePickerError, isValidDateTimePickerEvent } from "../dateTimePicker";
import { globalHangoutState } from "../globalHangoutState";
import { getDateAndTimeString } from "../globalHangoutUtils";
import { AvailabilitySlot } from "../hangoutTypes";
import { initAvailabilityCalendar, updateAvailabilityCalendar } from "./availabilityCalendar";
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
const availabilitySlotsContainer: HTMLDivElement | null = document.querySelector('#availability-slots-container');

export function hangoutAvailability(): void {
  loadEventListeners();
};

async function init(): Promise<void> {
  if (!globalHangoutState.data) {
    return;
  };

  await getHangoutAvailabilitySlots();
  initAvailabilityCalendar();
  render();
};

function render(): void {
  displayPersonalAvailabilitySlots();
  updateSlotsRemaining();
  updateAvailabilityCalendar();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-availability', init);
  availabilitySlotsContainer?.addEventListener('click', handleAvailabilitySlotsContainerClicks);

  addAvailabilityBtn?.addEventListener('click', () => {
    if (globalHangoutState.data?.hangoutDetails.is_concluded) {
      popup(`Can't add availability slots after hangout conclusion.`, 'error');
      LoadingModal.remove();

      return;
    };

    displayDateTimePicker('availabilitySlot');
  });

  document.addEventListener('dateTimePicker-selection', async (e: Event) => {
    if (!isValidDateTimePickerEvent(e) || e.detail.purpose !== 'availabilitySlot') {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

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
    const availabilitySlots: AvailabilitySlot[] = (await getHangoutAvailabilitySlotsService(hangoutId, hangoutMemberId)).data.availabilitySlots;

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
  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId } = globalHangoutState.data;
  const { startTimestamp, endTimestamp } = dateTimePickerData;

  const newSlotTimestamps: NewAvailabilitySlotTimestamps = { slotStartTimestamp: startTimestamp, slotEndTimestamp: endTimestamp };
  const overlappedSlot: AvailabilitySlot | null = overlapsWithExistingAvailabilitySlots(hangoutAvailabilityState.availabilitySlots, newSlotTimestamps);

  if (overlappedSlot) {
    const slotStartString: string = getDateAndTimeString(overlappedSlot.slot_start_timestamp);
    const slotEndString: string = getDateAndTimeString(overlappedSlot.slot_end_timestamp);

    InfoModal.display({
      title: 'Overlap detected.',
      description: `New availability slot overlaps with the following slot:\n${slotStartString} - ${slotEndString}.`,
      btnTitle: 'Okay',
    }, { simple: true });

    LoadingModal.remove();
    displayTimePickerError('Slot overlap detected.');

    return;
  };

  const addHangoutAvailabilitySlotBody: AddHangoutAvailabilitySlotBody = {
    hangoutId,
    hangoutMemberId,
    slotStartTimestamp: startTimestamp,
    slotEndTimestamp: endTimestamp,
  };

  try {
    const availabilitySlotId: number = (await addHangoutAvailabilitySlotService(addHangoutAvailabilitySlotBody)).data.resData.availabilitySlotId;

    const newAvailabilitySlot: AvailabilitySlot = {
      availability_slot_id: availabilitySlotId,
      hangout_member_id: hangoutMemberId,
      slot_start_timestamp: startTimestamp,
      slot_end_timestamp: endTimestamp,
    };

    hangoutAvailabilityState.availabilitySlots.push(newAvailabilitySlot);
    globalHangoutState.data.availabilitySlotsCount++;

    render();
    closeDateTimePicker();

    popup('Availability slot added.', 'success');
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

    if (status === 400 && (errReason === 'hangoutId' || errReason === 'hangoutMemberId')) {
      popup('Something went wrong', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 400) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired(window.location.href);
        return;
      };

      if (errReason === 'authSessionDestroyed') {
        handleAuthSessionDestroyed(window.location.href);
      };

      return;
    };

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);
    };
  };
};

interface NewAvailabilitySlotTimestamps {
  slotStartTimestamp: number,
  slotEndTimestamp: number,
};

function overlapsWithExistingAvailabilitySlots(existingSlots: AvailabilitySlot[], newSlotTimestamps: NewAvailabilitySlotTimestamps): AvailabilitySlot | null {
  if (existingSlots.length === 0) {
    return null;
  };

  for (const existingSlot of existingSlots) {
    if (existingSlot.slot_start_timestamp >= newSlotTimestamps.slotStartTimestamp && existingSlot.slot_start_timestamp <= newSlotTimestamps.slotEndTimestamp) {
      return existingSlot;
    };

    if (existingSlot.slot_end_timestamp >= newSlotTimestamps.slotStartTimestamp && existingSlot.slot_end_timestamp <= newSlotTimestamps.slotEndTimestamp) {
      return existingSlot;
    };

    if (existingSlot.slot_start_timestamp <= newSlotTimestamps.slotStartTimestamp && existingSlot.slot_end_timestamp >= newSlotTimestamps.slotEndTimestamp) {
      return existingSlot;
    };
  };

  return null;
};

function displayPersonalAvailabilitySlots(): void {
  if (hangoutAvailabilityState.availabilitySlots.length === 0) {
    return;
  };

  const availabilitySlotsElement: HTMLDivElement | null = document.querySelector('#availability-slots');

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

async function handleAvailabilitySlotsContainerClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLElement)) {
    return;
  };

  if (e.target.classList.contains('delete-btn')) {
    await deleteAvailabilitySlot();
    return;
  };
};

async function deleteAvailabilitySlot(): Promise<void> {
  // TODO: continue implementation
};