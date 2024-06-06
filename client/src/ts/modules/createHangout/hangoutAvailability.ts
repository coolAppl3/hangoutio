import { hangoutFormState } from "./hangoutFormState";

import datePicker from "../global/datePicker";
import timePicker from "../global/timePicker";
import popup from "../global/popup";

export default function hangoutAvailability(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  const datePickerInput: HTMLInputElement | null = document.querySelector('#date-picker-input');
  datePickerInput?.addEventListener('click', datePicker);

  const timePickerInput: HTMLInputElement | null = document.querySelector('#time-picker-input');
  timePickerInput?.addEventListener('click', () => { timePicker(hangoutFormState.dateText, hangoutFormState.timeSlots); });

  const selectedTimeSlots: HTMLDivElement | null = document.querySelector('#selected-time-slots');
  selectedTimeSlots?.addEventListener('click', removeSelectedSlot);

  window.addEventListener('datePickerDateSelected', updateSelectedDate);
  window.addEventListener('timeSlotsPicked', updateSelectedSlots);
};


// date picker
function updateSelectedDate(e: Event): void {
  const customEvent = e as CustomEvent<{ dateTimestamp: number, dateText: string }>;
  const eventData = customEvent.detail;

  hangoutFormState.dateTimestamp = eventData.dateTimestamp;
  hangoutFormState.dateText = eventData.dateText;

  displaySelectedDate();
  enableTimePickerInput();
};

function displaySelectedDate(): void {
  const datePickerInput: HTMLInputElement | null = document.querySelector('#date-picker-input');
  datePickerInput ? datePickerInput.value = hangoutFormState.dateText : undefined;
};

// time picker
function enableTimePickerInput(): void {
  const timePickerInput: HTMLInputElement | null = document.querySelector('#time-picker-input');

  if (!timePickerInput) {
    return;
  };

  timePickerInput.classList.remove('disabled');
  timePickerInput.removeAttribute('disabled');
  timePickerInput.removeAttribute('title');
};

type TimeSlot = { from: string, to: string };

function updateSelectedSlots(e: Event): void {
  const customEvent = e as CustomEvent<TimeSlot[]>;
  const selectedTimeSlots: TimeSlot[] = customEvent.detail;

  hangoutFormState.timeSlots = selectedTimeSlots;
  displaySelectedSlots();
};

function displaySelectedSlots(): void {
  const selectedTimeSlots: HTMLDivElement | null = document.querySelector('#selected-time-slots');
  const currentSlotsContainer: Element | null | undefined = selectedTimeSlots?.firstElementChild;

  const newSlotsContainer: HTMLDivElement = document.createElement('div');
  newSlotsContainer.className = 'selected-time-slots-container';

  for (const slot of hangoutFormState.timeSlots) {
    newSlotsContainer.appendChild(createTimeSlotElement(slot.from, slot.to));
  };

  currentSlotsContainer?.remove();
  selectedTimeSlots?.appendChild(newSlotsContainer);

  dispatchSlotsChangedEvent();
};

function createTimeSlotElement(from: string, to: string): HTMLSpanElement {
  const span: HTMLSpanElement = document.createElement('span');
  span.className = 'selected-time-slots-item';
  span.appendChild(document.createTextNode(`${from} - ${to}`));

  return span;
};

function removeSelectedSlot(e: MouseEvent): void {
  if (!(e.target instanceof HTMLElement)) {
    return;
  };

  if (e.target.className !== 'selected-time-slots-item') {
    return;
  };

  const selectedSlot: HTMLSpanElement = e.target;
  const slotValue: string | null = selectedSlot.textContent;

  if (!slotValue) {
    return;
  };

  const fromValue: string = slotValue?.split(' - ')[0];
  const toValue: string = slotValue?.split(' - ')[1];

  const slotIndex: number = hangoutFormState.timeSlots.findIndex(({ from, to }) => from === fromValue && to === toValue);

  if (slotIndex === -1) {
    selectedSlot.remove();
    popup('Slot removed.', 'success');
    return;
  };

  hangoutFormState.timeSlots.splice(slotIndex, 1);
  popup('Slot removed.', 'success');
  displaySelectedSlots();
};

function dispatchSlotsChangedEvent(): void {
  const slotsChangedEvent: CustomEvent = new CustomEvent<undefined>('timeSlotsChanged');
  window.dispatchEvent(slotsChangedEvent);
};