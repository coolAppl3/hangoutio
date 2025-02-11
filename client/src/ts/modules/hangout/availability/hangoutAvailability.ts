import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../../global/authUtils";
import { HANGOUT_AVAILABILITY_SLOTS_LIMIT } from "../../global/clientConstants";
import { ConfirmModal } from "../../global/ConfirmModal";
import { createDivElement } from "../../global/domUtils";
import { InfoModal } from "../../global/InfoModal";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { AddHangoutAvailabilitySlotBody, addHangoutAvailabilitySlotService, ClearHangoutAvailabilitySlotBody, clearHangoutAvailabilitySlotService, DeleteHangoutAvailabilitySlotBody, deleteHangoutAvailabilitySlotService, EditHangoutAvailabilitySlotBody, editHangoutAvailabilitySlotService, getHangoutAvailabilitySlotsService } from "../../services/availabilitySlotsServices";
import { closeDateTimePicker, DateTimePickerData, displayDateTimePicker, displayTimePickerError, isValidDateTimePickerEvent } from "../dateTimePicker";
import { globalHangoutState } from "../globalHangoutState";
import { getDateAndTimeString } from "../../global/dateTimeUtils";
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
const clearAvailabilitySlotsBtn: HTMLButtonElement | null = document.querySelector('#clear-availability-slots-btn');

export function hangoutAvailability(): void {
  loadEventListeners();
};

export async function initHangoutAvailability(): Promise<void> {
  if (hangoutAvailabilityState.isLoaded) {
    renderAvailabilitySection();
    return;
  };

  if (!globalHangoutState.data) {
    popup('Failed to load availability slots.', 'error');
    return;
  };

  LoadingModal.display();

  await getHangoutAvailabilitySlots();
  initAvailabilityCalendar();
  renderAvailabilitySection();

  LoadingModal.remove();
};

function renderAvailabilitySection(): void {
  displayPersonalAvailabilitySlots();
  updateSlotsRemaining();
  updateAvailabilityCalendar();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-availability', initHangoutAvailability);
  availabilitySlotsContainer?.addEventListener('click', handleAvailabilitySlotsContainerClicks);

  addAvailabilityBtn?.addEventListener('click', () => {
    if (!globalHangoutState.data) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { hangoutDetails, availabilitySlotsCount } = globalHangoutState.data;

    if (hangoutDetails.is_concluded) {
      popup(`Hangout has already been concluded.`, 'error');
      return;
    };

    if (availabilitySlotsCount >= HANGOUT_AVAILABILITY_SLOTS_LIMIT) {
      popup(`Availability slot limit of ${HANGOUT_AVAILABILITY_SLOTS_LIMIT} already reached.`, 'error');
      return;
    };

    displayDateTimePicker('availabilitySlot');
  });

  clearAvailabilitySlotsBtn?.addEventListener('click', () => {
    const confirmModal: HTMLDivElement = ConfirmModal.display({
      title: 'Are you sure you want to clear all your availability slots?',
      description: null,
      confirmBtnTitle: 'Clear all slots',
      cancelBtnTitle: 'Cancel',
      extraBtnTitle: null,
      isDangerousAction: true,
    });

    confirmModal.addEventListener('click', async (e: MouseEvent) => {
      if (!(e.target instanceof HTMLElement)) {
        return;
      };

      if (e.target.id === 'confirm-modal-confirm-btn') {
        ConfirmModal.remove();
        await clearAvailabilitySlots();

        return;
      };

      if (e.target.id === 'confirm-modal-cancel-btn') {
        ConfirmModal.remove();
      };
    });
  });

  document.addEventListener('dateTimePicker-selection', async (e: Event) => {
    if (!isValidDateTimePickerEvent(e) || e.detail.purpose !== 'availabilitySlot') {
      return;
    };

    const dateTimePickerData: DateTimePickerData = e.detail;

    if (!dateTimePickerData.existingSlotId) {
      await addHangoutAvailabilitySlot(dateTimePickerData);
      return;
    };

    await editHangoutAvailabilitySlot(dateTimePickerData);
  });
};

async function getHangoutAvailabilitySlots(): Promise<void> {
  if (hangoutAvailabilityState.isLoaded) {
    return;
  };

  if (!globalHangoutState.data) {
    popup('Failed to load availability slots.', 'error');
    return;
  };

  try {
    const { hangoutId, hangoutMemberId } = globalHangoutState.data;
    const availabilitySlots: AvailabilitySlot[] = (await getHangoutAvailabilitySlotsService(hangoutId, hangoutMemberId)).data.availabilitySlots;

    hangoutAvailabilityState.availabilitySlots = availabilitySlots;
    hangoutAvailabilityState.isLoaded = true;

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Failed to load availability slots.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Failed to load availability slots.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 400) {
      popup('Failed to load availability slots.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      if (errReason === 'notHangoutMember') {
        setTimeout(() => {
          sessionStorage.removeItem('latestHangoutSection');
          window.location.href = 'home';
        }, 1000);
      };

      return;
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
    const availabilitySlotId: number = (await addHangoutAvailabilitySlotService(addHangoutAvailabilitySlotBody)).data.availabilitySlotId;

    const newAvailabilitySlot: AvailabilitySlot = {
      availability_slot_id: availabilitySlotId,
      hangout_member_id: hangoutMemberId,
      slot_start_timestamp: startTimestamp,
      slot_end_timestamp: endTimestamp,
    };

    hangoutAvailabilityState.availabilitySlots.push(newAvailabilitySlot);
    hangoutAvailabilityState.availabilitySlots.sort((a, b) => a.slot_start_timestamp - b.slot_start_timestamp);
    globalHangoutState.data.availabilitySlotsCount++;

    renderAvailabilitySection();
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
    const errResData: unknown = axiosError.response.data.resData;

    if (status === 400 && (errReason === 'hangoutId' || errReason === 'hangoutMemberId')) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      if (errReason === 'authSessionDestroyed') {
        handleAuthSessionDestroyed();
      };

      return;
    };

    if (status === 409) {
      if (errReason === 'slotOverlap') {
        handleSlotOverlap(errResData);
        return;
      };

      if (errReason === 'invalidStart') {
        displayTimePickerError(errMessage, 'start');
      };

      return;
    };

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);
    };
  };
};

async function handleAvailabilitySlotsContainerClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLElement)) {
    return;
  };

  const availabilitySlotId: number | null = getAvailabilitySlotElementId(e);

  if (!availabilitySlotId) {
    return;
  };

  if (e.target.classList.contains('edit-btn')) {
    displayDateTimePicker('availabilitySlot', availabilitySlotId);
    return;
  };

  if (e.target.classList.contains('delete-btn')) {
    await deleteAvailabilitySlot(availabilitySlotId);
  };
};

async function editHangoutAvailabilitySlot(dateTimePickerData: DateTimePickerData): Promise<void> {
  if (!globalHangoutState.data || !dateTimePickerData.existingSlotId) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId, hangoutDetails } = globalHangoutState.data;

  if (hangoutDetails.is_concluded) {
    popup('Hangout has already been concluded.', 'success');
    LoadingModal.remove();

    closeDateTimePicker();
    return;
  };

  const editHangoutAvailabilitySlotBody: EditHangoutAvailabilitySlotBody = {
    hangoutId,
    hangoutMemberId,
    availabilitySlotId: dateTimePickerData.existingSlotId,
    slotStartTimestamp: dateTimePickerData.startTimestamp,
    slotEndTimestamp: dateTimePickerData.endTimestamp,
  };

  try {
    await editHangoutAvailabilitySlotService(editHangoutAvailabilitySlotBody);

    const existingSlot: AvailabilitySlot | undefined = hangoutAvailabilityState.availabilitySlots.find((slot: AvailabilitySlot) => slot.availability_slot_id === dateTimePickerData.existingSlotId);

    if (existingSlot) {
      existingSlot.slot_start_timestamp = dateTimePickerData.startTimestamp;
      existingSlot.slot_end_timestamp = dateTimePickerData.endTimestamp;
    };

    hangoutAvailabilityState.availabilitySlots.sort((a, b) => a.slot_start_timestamp - b.slot_start_timestamp);

    popup('Availability slot updated.', 'success');
    LoadingModal.remove();

    closeDateTimePicker();
    renderAvailabilitySection();

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
    const errResData: unknown = axiosError.response.data.resData;

    if (status === 400) {
      if (errReason === 'invalidSlot') {
        popup(errMessage, 'error');
        return;
      };

      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 409) {
      if (errReason === 'hangoutConcluded') {
        closeDateTimePicker();
        return;
      };

      if (errReason === 'slotOverlap') {
        handleSlotOverlap(errResData);
        return;
      };

      if (errReason === 'invalidStart' || errReason === 'slotIdentical') {
        displayTimePickerError(errMessage, 'start');
      };

      return;
    };

    if (status === 404) {
      if (errReason === 'hangoutNotFound') {
        setTimeout(() => window.location.reload(), 1000);
        return;
      };

      if (errReason === 'slotNotFound') {
        const availabilitySlotIndex: number = hangoutAvailabilityState.availabilitySlots.findIndex((slot: AvailabilitySlot) => slot.availability_slot_id === dateTimePickerData.existingSlotId);
        (availabilitySlotIndex !== -1) && hangoutAvailabilityState.availabilitySlots.splice(availabilitySlotIndex, 1);

        renderAvailabilitySection();
      };

      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      if (errReason === 'authSessionDestroyed') {
        handleAuthSessionDestroyed();
      };
    };
  };
};

async function deleteAvailabilitySlot(availabilitySlotId: number): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId } = globalHangoutState.data;
  const deleteHangoutAvailabilitySlotBody: DeleteHangoutAvailabilitySlotBody = {
    hangoutId,
    hangoutMemberId,
    availabilitySlotId,
  };

  try {
    await deleteHangoutAvailabilitySlotService(deleteHangoutAvailabilitySlotBody);

    const availabilitySlotIndex: number = hangoutAvailabilityState.availabilitySlots.findIndex((slot: AvailabilitySlot) => slot.availability_slot_id === availabilitySlotId);

    (availabilitySlotIndex !== -1) && hangoutAvailabilityState.availabilitySlots.splice(availabilitySlotIndex, 1);
    globalHangoutState.data.availabilitySlotsCount--;

    popup('Availability slot deleted.', 'success');
    LoadingModal.remove();

    renderAvailabilitySection();

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

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 404) {
      if (errReason === 'hangoutNotFound') {
        setTimeout(() => window.location.reload(), 1000);
        return;
      };

      if (errReason === 'slotNotFound') {
        const availabilitySlotIndex: number = hangoutAvailabilityState.availabilitySlots.findIndex((slot: AvailabilitySlot) => slot.availability_slot_id === availabilitySlotId);
        (availabilitySlotIndex !== -1) && hangoutAvailabilityState.availabilitySlots.splice(availabilitySlotIndex, 1);

        renderAvailabilitySection();
      };

      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      if (errReason === 'authSessionDestroyed') {
        handleAuthSessionDestroyed();
      };
    };
  };
};

async function clearAvailabilitySlots(): Promise<void> {
  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { hangoutId, hangoutMemberId } = globalHangoutState.data;
  const clearHangoutAvailabilitySlotBody: ClearHangoutAvailabilitySlotBody = { hangoutId, hangoutMemberId };

  try {
    await clearHangoutAvailabilitySlotService(clearHangoutAvailabilitySlotBody);

    globalHangoutState.data.availabilitySlotsCount = 0;
    hangoutAvailabilityState.availabilitySlots.length = 0;

    popup('Availability slots cleared.', 'success');
    LoadingModal.remove();

    renderAvailabilitySection();

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

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 404) {
      if (errReason === 'hangoutNotFound') {
        setTimeout(() => window.location.reload(), 1000);
        return;
      };

      if (errReason === 'noSlotsFound') {
        hangoutAvailabilityState.availabilitySlots.length = 0;
        globalHangoutState.data.availabilitySlotsCount = 10;

        renderAvailabilitySection();
      };

      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      if (errReason === 'authSessionDestroyed') {
        handleAuthSessionDestroyed();
      };
    };
  };
};

function getAvailabilitySlotElementId(e: MouseEvent): number | null {
  if (!(e.target instanceof HTMLElement)) {
    return null;
  };


  if (e.target.nodeName !== 'BUTTON') {
    return null;
  };

  const availabilitySlotElement: Element | null = e.target.closest('.slot');

  if (!(availabilitySlotElement instanceof HTMLDivElement)) {
    return null;
  };

  const availabilitySlotIdAttribute: string | null = availabilitySlotElement.getAttribute('data-slotId');

  if (!availabilitySlotIdAttribute) {
    return null;
  };

  const availabilitySlotId: number = +availabilitySlotIdAttribute;

  if (!Number.isInteger(availabilitySlotId)) {
    return null;
  };

  return availabilitySlotId;
};

function displayPersonalAvailabilitySlots(): void {
  const availabilitySlotsElement: HTMLDivElement | null = document.querySelector('#availability-slots');

  if (!availabilitySlotsElement || !availabilitySlotsContainer) {
    popup('Failed to load your availability slots.', 'error');
    return;
  };

  if (hangoutAvailabilityState.availabilitySlots.length === 0) {
    availabilitySlotsElement.classList.add('hidden');
    return;
  };

  const innerContainer: HTMLDivElement = createDivElement(null);

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
  slotsRemainingSpan && (slotsRemainingSpan.textContent = `${slotsRemaining}`);
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

function handleSlotOverlap(errResData: unknown): void {
  if (typeof errResData !== 'object' || errResData === null) {
    return;
  };

  if (!('overlappedSlotId' in errResData) || typeof errResData.overlappedSlotId !== 'number') {
    return;
  };

  const overlappedSlotId: number = errResData.overlappedSlotId;

  if (!Number.isInteger(overlappedSlotId)) {
    return;
  };

  const overlappedSlot: AvailabilitySlot | undefined = hangoutAvailabilityState.availabilitySlots.find((slot: AvailabilitySlot) => slot.availability_slot_id === overlappedSlotId);

  if (!overlappedSlot) {
    return;
  };

  const slotStartString: string = getDateAndTimeString(overlappedSlot.slot_start_timestamp);
  const slotEndString: string = getDateAndTimeString(overlappedSlot.slot_end_timestamp);

  InfoModal.display({
    title: 'Overlap detected.',
    description: `New availability slot overlaps with the following slot:\n${slotStartString} - ${slotEndString}.`,
    btnTitle: 'Okay',
  }, { simple: true });

  displayTimePickerError('Slot overlap detected.');
};