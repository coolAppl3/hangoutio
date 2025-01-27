import { dayMilliseconds, HANGOUT_AVAILABILITY_SLOTS_LIMIT, hourMilliseconds } from "../../global/clientConstants";
import { InfoModal } from "../../global/InfoModal";
import { switchToDateTimePicker } from "../dateTimePicker";
import { globalHangoutState } from "../globalHangoutState";
import { getMonthName, getTime } from "../globalHangoutUtils";
import { AvailabilitySlot, HangoutMember } from "../hangoutTypes";
import { hangoutAvailabilityState } from "./hangoutAvailability";

interface AvailabilityPreviewerState {
  hasBeenInitiated: boolean,

  data: null | {
    selectedDateTimestamp: number,

    previousDateTimestamp: number | null,
    nextDateTimestamp: number | null,
  },
};

let availabilityPreviewerState: AvailabilityPreviewerState = {
  hasBeenInitiated: false,
  data: null,
};

const availabilityPreviewerElement: HTMLDivElement | null = document.querySelector('#availability-previewer');
const availabilityPreviewerSlotsElement: HTMLDivElement | null = document.querySelector('#availability-previewer-slots');

const availabilityPreviewerHeader: HTMLDivElement | null = document.querySelector('#availability-previewer-header');
const availabilityPreviewerHeaderTitle: HTMLParagraphElement | null = document.querySelector('#availability-previewer-header-title');

const availabilityPreviewerBackwardsBtn: HTMLButtonElement | null = document.querySelector('#availability-previewer-backwards-btn');
const availabilityPreviewerForwardsBtn: HTMLButtonElement | null = document.querySelector('#availability-previewer-forwards-btn');

const availabilityPreviewerAddBtn: HTMLButtonElement | null = document.querySelector('#availability-previewer-add-btn');
const availabilityPreviewerCloseBtn: HTMLButtonElement | null = document.querySelector('#availability-previewer-close-btn');


export function displayAvailabilityPreviewer(selectedDateTimestamp: number): void {
  if (!availabilityPreviewerElement) {
    return;
  };

  const isFirstInit: boolean = availabilityPreviewerState.hasBeenInitiated === false;
  availabilityPreviewerState.hasBeenInitiated = true;

  availabilityPreviewerState.data = {
    selectedDateTimestamp,

    previousDateTimestamp: findPreviousDateTimestamp(selectedDateTimestamp),
    nextDateTimestamp: findNextDateTimestamp(selectedDateTimestamp),
  };

  render(selectedDateTimestamp);

  availabilityPreviewerElement.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      availabilityPreviewerElement.classList.add('revealed');
    });
  });

  if (isFirstInit) {
    loadEventListeners();
  };
};

function render(selectedDateTimestamp: number): void {
  if (!availabilityPreviewerSlotsElement) {
    return;
  };

  availabilityPreviewerSlotsElement.firstElementChild?.remove();
  availabilityPreviewerSlotsElement.appendChild(createAvailabilityPreviewerSlotsContainer(selectedDateTimestamp));

  updateHeaderDate(selectedDateTimestamp);
  updateNavigationButtons();
};

function findPreviousDateTimestamp(selectedDateTimestamp: number): number | null {
  const selectedDate: number = new Date(selectedDateTimestamp).getDate();

  for (let i = hangoutAvailabilityState.availabilitySlots.length - 1; i >= 0; i--) {
    const slot: AvailabilitySlot = hangoutAvailabilityState.availabilitySlots[i];

    if (slot.slot_start_timestamp >= selectedDateTimestamp) {
      continue;
    };

    const slotDate: Date = new Date(slot.slot_start_timestamp);

    if (slotDate.getDate() === selectedDate && Math.abs(slot.slot_start_timestamp - selectedDateTimestamp) < hourMilliseconds) {
      continue;
    };

    slotDate.setHours(0);
    slotDate.setMinutes(0);

    return slotDate.getTime();
  };

  return null;
};

function findNextDateTimestamp(selectedDateTimestamp: number): number | null {
  const selectedDate: number = new Date(selectedDateTimestamp).getDate();

  for (let i = 0; i < hangoutAvailabilityState.availabilitySlots.length; i++) {
    const slot: AvailabilitySlot = hangoutAvailabilityState.availabilitySlots[i];

    if (slot.slot_start_timestamp <= selectedDateTimestamp) {
      continue;
    };

    const slotDate: Date = new Date(slot.slot_start_timestamp);

    if (slotDate.getDate() === selectedDate && Math.abs(slot.slot_start_timestamp - selectedDateTimestamp) < dayMilliseconds) {
      continue;
    };

    slotDate.setHours(0);
    slotDate.setMinutes(0);

    return slotDate.getTime();
  };

  return null;
};

interface MemberSlotData {
  display_name: string,
  slots: AvailabilitySlot[],
};

function createAvailabilityPreviewerSlotsContainer(selectedDateTimestamp: number): HTMLDivElement {
  const availabilityPreviewerContainer: HTMLDivElement = document.createElement('div');
  availabilityPreviewerContainer.id = 'availability-previewer-slots-container';

  if (!globalHangoutState.data || hangoutAvailabilityState.availabilitySlots.length === 0) {
    availabilityPreviewerContainer.classList.add('empty');
    return availabilityPreviewerContainer;
  };

  const memberSlotsMap: Map<number, MemberSlotData> = new Map();

  const hangoutMembers: HangoutMember[] = globalHangoutState.data.hangoutMembers;
  for (const member of hangoutMembers) {
    memberSlotsMap.set(member.hangout_member_id, { display_name: member.display_name, slots: [] });
  };

  for (const slot of hangoutAvailabilityState.availabilitySlots) {
    const member: MemberSlotData | undefined = memberSlotsMap.get(slot.hangout_member_id);

    if (!member) {
      continue;
    };

    if (slot.slot_start_timestamp < selectedDateTimestamp || slot.slot_start_timestamp - selectedDateTimestamp >= dayMilliseconds) {
      continue;
    };

    member.slots.push(slot);
  };

  for (const memberSlotData of memberSlotsMap.values()) {
    if (memberSlotData.slots.length === 0) {
      continue;
    };

    availabilityPreviewerContainer.appendChild(createMemberElement(memberSlotData));
  };

  if (!availabilityPreviewerContainer.firstElementChild) {
    availabilityPreviewerContainer.classList.add('empty');
  };

  return availabilityPreviewerContainer;
};

function createMemberElement(memberSlotData: MemberSlotData): HTMLDivElement {
  const memberElement: HTMLDivElement = document.createElement('div');
  memberElement.className = 'member';
  memberElement.setAttribute('data-member-id', `${memberSlotData.slots[0].hangout_member_id}`);

  memberElement.appendChild(createMemberNameElement(memberSlotData.display_name));
  memberElement.appendChild(createMemberSlotsContainer(memberSlotData.slots));

  return memberElement;
};

function createMemberNameElement(hangoutMemberDisplayName: string): HTMLParagraphElement {
  const memberNameElement: HTMLParagraphElement = document.createElement('p');
  memberNameElement.className = 'member-name';
  memberNameElement.appendChild(document.createTextNode(hangoutMemberDisplayName));

  return memberNameElement;
};

function createMemberSlotsContainer(availabilitySlots: AvailabilitySlot[]): HTMLUListElement {
  const memberSlotsContainer: HTMLUListElement = document.createElement('ul');
  memberSlotsContainer.className = 'member-slots';

  for (const slot of availabilitySlots) {
    memberSlotsContainer.appendChild(createSlotElement(slot.slot_start_timestamp, slot.slot_end_timestamp));
  };

  return memberSlotsContainer;
};

function createSlotElement(slotStartTimestamp: number, slotEndTimestamp: number): HTMLLIElement {
  const slotElement: HTMLLIElement = document.createElement('li');
  slotElement.className = 'slot';

  const slotStartDateObj: Date = new Date(slotStartTimestamp);
  const slotEndDateObj: Date = new Date(slotEndTimestamp);

  const slotStartString: string = getTime(slotStartDateObj);
  let slotEndString: string = getTime(slotEndDateObj);

  if (slotStartDateObj.getDate() < slotEndDateObj.getDate()) {
    slotEndString += ' (next day)';
  };

  slotElement.appendChild(document.createTextNode(`${slotStartString} - ${slotEndString}`));
  return slotElement;
};

function updateHeaderDate(selectedDateTimestamp: number): void {
  if (!availabilityPreviewerHeaderTitle) {
    return;
  };

  const selectedDateObj: Date = new Date(selectedDateTimestamp);

  const selectedYear: number = selectedDateObj.getFullYear();
  const selectedMonth: string = getMonthName(selectedDateObj);
  const selectedDate: number = selectedDateObj.getDate();

  availabilityPreviewerHeaderTitle.textContent = `${selectedMonth} ${selectedDate}, ${selectedYear}`;
};

function updateNavigationButtons(): void {
  if (!availabilityPreviewerState.data) {
    return;
  };

  if (!availabilityPreviewerBackwardsBtn || !availabilityPreviewerForwardsBtn) {
    return;
  };

  const { previousDateTimestamp, nextDateTimestamp } = availabilityPreviewerState.data;

  previousDateTimestamp ? availabilityPreviewerBackwardsBtn.classList.remove('disabled') : availabilityPreviewerBackwardsBtn.classList.add('disabled');
  nextDateTimestamp ? availabilityPreviewerForwardsBtn.classList.remove('disabled') : availabilityPreviewerForwardsBtn.classList.add('disabled');
};

function loadEventListeners(): void {
  availabilityPreviewerHeader?.addEventListener('click', handleNavigationClicks);

  availabilityPreviewerCloseBtn?.addEventListener('click', closeAvailabilityPreviewer);
  availabilityPreviewerAddBtn?.addEventListener('click', () => {
    if (!availabilityPreviewerState.data || !globalHangoutState.data) {
      return;
    };

    if (globalHangoutState.data.availabilitySlotsCount >= HANGOUT_AVAILABILITY_SLOTS_LIMIT) {
      closeAvailabilityPreviewer();
      const infoModal: HTMLDivElement = InfoModal.display({
        title: `Availability slot limit of ${HANGOUT_AVAILABILITY_SLOTS_LIMIT} has been reached.`,
        description: 'Delete or edit one of your existing slots.',
        btnTitle: 'Okay',
      });

      infoModal.addEventListener('click', (e: MouseEvent) => {
        if (!(e.target instanceof HTMLElement)) {
          return;
        };

        if (e.target.id === 'info-modal-btn') {
          InfoModal.remove();
        };
      });

      return;
    };

    switchToDateTimePicker(availabilityPreviewerState.data.selectedDateTimestamp);
    closeAvailabilityPreviewer();
  });
};

function handleNavigationClicks(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id.includes('backwards')) {
    navigateBackwards();
    return;
  };

  if (e.target.id.includes('forwards')) {
    navigateForwards();
  };
};

function navigateBackwards(): void {
  if (!availabilityPreviewerState.data) {
    return;
  };

  const { previousDateTimestamp, selectedDateTimestamp } = availabilityPreviewerState.data;

  if (!previousDateTimestamp) {
    return;
  };

  const newPreviousDateTimestamp: number | null = findPreviousDateTimestamp(previousDateTimestamp);

  availabilityPreviewerState.data.nextDateTimestamp = selectedDateTimestamp;
  availabilityPreviewerState.data.selectedDateTimestamp = previousDateTimestamp;
  availabilityPreviewerState.data.previousDateTimestamp = newPreviousDateTimestamp;

  render(availabilityPreviewerState.data.selectedDateTimestamp);
  updateHeaderDate(availabilityPreviewerState.data.selectedDateTimestamp);
  updateNavigationButtons();
};

function navigateForwards(): void {
  if (!availabilityPreviewerState.data) {
    return;
  };

  const { nextDateTimestamp, selectedDateTimestamp } = availabilityPreviewerState.data;

  if (!nextDateTimestamp) {
    return;
  };

  const newNextDateTimestamp: number | null = findNextDateTimestamp(nextDateTimestamp);

  availabilityPreviewerState.data.previousDateTimestamp = selectedDateTimestamp;
  availabilityPreviewerState.data.selectedDateTimestamp = nextDateTimestamp;
  availabilityPreviewerState.data.nextDateTimestamp = newNextDateTimestamp;

  render(availabilityPreviewerState.data.selectedDateTimestamp);
  updateHeaderDate(availabilityPreviewerState.data.selectedDateTimestamp);
  updateNavigationButtons();
};

function closeAvailabilityPreviewer(): void {
  if (!availabilityPreviewerElement) {
    return;
  };

  availabilityPreviewerElement.classList.remove('revealed');

  setTimeout(() => {
    availabilityPreviewerElement.style.display = 'none';
  }, 150);
};