import ErrorSpan from "./ErrorSpan";
import popup from "./popup";

type TimeSlot = { from: string, to: string };

interface TimePickerState {
  selectedDate: string;
  slots: TimeSlot[];
  maxTimeSlots: number
};

const timePickerState: TimePickerState = {
  selectedDate: '',
  slots: [],
  maxTimeSlots: 3,
};

export default function timePicker(selectedDate: string, existingSlots: TimeSlot[]): void {
  timePickerState.slots = existingSlots;

  initTimePicker(selectedDate);
  loadEventListeners();
};

function loadEventListeners(): void {
  const addSlotBtn: HTMLButtonElement | null = document.querySelector('#time-picker-input-add');
  addSlotBtn?.addEventListener('click', addTimeSlot);

  const slotsContainer: HTMLDivElement | null = document.querySelector('#time-picker-slots');
  slotsContainer?.addEventListener('click', removeSlot);

  const datePickerBtnContainer: HTMLDivElement | null = document.querySelector('#time-picker-btn-container');
  datePickerBtnContainer?.addEventListener('click', handleSubmission);
};

function render(): void {
  displaySelectedSlots(timePickerState.slots);
  handleElementsDisabledState();
  clearInputs();
};

// initialization
function initTimePicker(selectedDate: string): void {
  displayTimePicker();
  displaySelectedDate(selectedDate);
  render();
};

// slots
function addTimeSlot(): void {
  if (timePickerState.slots.length === timePickerState.maxTimeSlots) {
    return;
  };

  const fromInput: HTMLInputElement | null = document.querySelector('#time-picker-from');
  const toInput: HTMLInputElement | null = document.querySelector('#time-picker-to');

  if (!fromInput || !toInput) {
    return;
  };

  const isValidFrom: boolean = isValidTimeFormat(fromInput);
  const isValidTo: boolean = isValidTimeFormat(toInput);

  if (!isValidFrom || !isValidTo) {
    return;
  };

  if (!isValidTimeSlot(fromInput, toInput)) {
    return;
  };

  const newSlot: TimeSlot = {
    from: fromInput.value,
    to: toInput.value,
  };

  if (intersectsWithExistingSlots(newSlot)) {
    ErrorSpan.display(fromInput, '');
    ErrorSpan.display(toInput, `The slot you're trying to add intersects with one or more existing slots.`);
    return;
  };

  timePickerState.slots.push(newSlot);
  render();
};

function removeSlot(e: MouseEvent): void {
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

  const slotIndex: number = timePickerState.slots.findIndex(({ from, to }) => from === fromValue && to === toValue);

  if (slotIndex === -1) {
    selectedSlot.remove();
    popup('Slot removed.', 'success');
    return;
  };

  timePickerState.slots.splice(slotIndex, 1);

  dispatchSelectedSlots();
  render();
  popup('Slot removed.', 'success');
};

// validation
function isValidTimeFormat(input: HTMLInputElement): boolean {
  if (input.value.trim() === '') {
    ErrorSpan.display(input, 'Please provide a time value.');
    return false;
  };

  const validTimeRegex: RegExp = /^[0-2][0-9]:[0-5][0-9]$/;
  if (!validTimeRegex.test(input.value)) {
    ErrorSpan.display(input, 'Please use a valid 24-hour format (HH:MM).');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

function isValidTimeSlot(fromInput: HTMLInputElement, toInput: HTMLInputElement): boolean {
  const fromTime: number = getTimeNumber(fromInput.value);
  const toTime: number = getTimeNumber(toInput.value);

  if (toTime === 0) {
    ErrorSpan.display(toInput, `The end of the slot can't exceed 23:59.`);
    return false;
  };

  if (toTime < fromTime) {
    ErrorSpan.display(toInput, `The slot's end can't be before its start.`);
    return false;
  };

  if (toTime - fromTime < 100) {
    ErrorSpan.display(toInput, `Time slot can't be shorter than an hour.`);
    return false;
  };

  return true;
};

function intersectsWithExistingSlots(newSlot: TimeSlot): boolean {
  for (const slot of timePickerState.slots) {
    if (endsMatch(slot, newSlot)) {
      return true;
    };

    if (isWithinExistingSlot(slot, newSlot.from) || isWithinExistingSlot(slot, newSlot.to)) {
      return true;
    };

    if (includesExistingSlot(slot, newSlot)) {
      return true;
    };
  };

  return false;
};

function endsMatch(slot: TimeSlot, newSlot: TimeSlot): boolean {
  if (slot.from === newSlot.from || slot.from === newSlot.to) {
    return true;
  };

  if (slot.to === newSlot.from || slot.to === newSlot.to) {
    return true;
  };

  return false;
};

function isWithinExistingSlot(slot: TimeSlot, time: string): boolean {
  const slotFrom: number = getTimeNumber(slot.from);
  const slotTo: number = getTimeNumber(slot.to);
  const timeNumber: number = getTimeNumber(time);

  if (timeNumber > slotFrom && timeNumber < slotTo) {
    return true;
  };

  return false;
};

function includesExistingSlot(slot: TimeSlot, newSlot: TimeSlot): boolean {
  if (newSlot.from < slot.from && newSlot.to > slot.to) {
    return true;
  };

  return false;
};

// submission
function handleSubmission(e: MouseEvent): void {
  if (!e.target || e.target instanceof HTMLButtonElement === false) {
    return;
  };

  if (e.target.id === 'time-picker-close') {
    closeTimePicker();
  };

  if (e.target.id === 'time-picker-confirm') {
    confirmTimeSlots();
  };
};

function closeTimePicker(): void {
  hideDatePicker();
  resetGlobalState();
};

function confirmTimeSlots(): void {
  if (timePickerState.slots.length === 0) {
    popup('You must include at least one time slot.', 'error');
    return;
  };

  dispatchSelectedSlots();
  closeTimePicker();
};

// util
function displayTimePicker(): void {
  const timePickerModal: HTMLDivElement | null = document.querySelector('#time-picker-modal');
  timePickerModal?.classList.add('displayed');

  setTimeout(() => { timePickerModal?.firstElementChild?.classList.add('in-position') }, 100);
};

function hideDatePicker(): void {
  const timePickerModal: HTMLElement | null = document.querySelector('#time-picker-modal');
  timePickerModal?.firstElementChild?.classList.remove('in-position');

  setTimeout(() => { timePickerModal?.classList.remove('displayed') }, 100);
};

function resetGlobalState(): void {
  resetState();
  resetUIState();
};

function resetState(): void {
  timePickerState.selectedDate = '';
  timePickerState.slots = [];
};

function resetUIState(): void {
  const fromInput: HTMLInputElement | null = document.querySelector('#time-picker-from');
  const toInput: HTMLInputElement | null = document.querySelector('#time-picker-to');

  if (!fromInput || !toInput) {
    return;
  };

  ErrorSpan.hide(fromInput);
  ErrorSpan.hide(toInput);
};

function displaySelectedDate(selectedDate: string): void {
  const selectedDateSpan: HTMLSpanElement | null = document.querySelector('#time-picker-selected-date');
  selectedDateSpan ? selectedDateSpan.textContent = selectedDate : undefined;
};

function displaySelectedSlots(slots: TimeSlot[]): void {
  const timePickerSlotsElement: HTMLDivElement | null = document.querySelector('#time-picker-slots');
  const currentSlotsContainer: HTMLDivElement | null = document.querySelector('#time-picker-slots-container');

  const newSlotsContainer: HTMLDivElement = document.createElement('div');
  newSlotsContainer.id = 'time-picker-slots-container';

  if (slots.length === 0) {
    newSlotsContainer.appendChild(createNoSlotsSpan());
    currentSlotsContainer?.remove();
    timePickerSlotsElement?.appendChild(newSlotsContainer);

    return;
  };

  for (const slot of slots) {
    newSlotsContainer.appendChild(createSlotSpan(slot));
  };

  currentSlotsContainer?.remove();
  timePickerSlotsElement?.appendChild(newSlotsContainer);
};

function createSlotSpan(slot: TimeSlot): HTMLSpanElement {
  const slotSpan: HTMLSpanElement = document.createElement('span');
  slotSpan.className = 'selected-time-slots-item';
  slotSpan.appendChild(document.createTextNode(`${slot.from} - ${slot.to}`));

  return slotSpan;
};

function createNoSlotsSpan(): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'no-slots';
  span.appendChild(document.createTextNode('No slots added yet.'));

  return span;
};

function handleElementsDisabledState(): void {
  handleInputState();
  handleAddSlotBtnState();
  handleConfirmBtnState();
};

function handleInputState(): void {
  const fromInput: HTMLInputElement | null = document.querySelector('#time-picker-from');
  const toInput: HTMLInputElement | null = document.querySelector('#time-picker-to');

  if (!fromInput || !toInput) {
    return;
  };

  if (timePickerState.slots.length === timePickerState.maxTimeSlots) {
    disableElement(fromInput);
    disableElement(toInput);

    return;
  };

  enableElement(fromInput);
  enableElement(toInput);
};

function handleAddSlotBtnState(): void {
  const addSlotBtn: HTMLButtonElement | null = document.querySelector('#time-picker-input-add');

  if (timePickerState.slots.length === timePickerState.maxTimeSlots) {
    addSlotBtn ? disableElement(addSlotBtn) : undefined;
    addSlotBtn?.setAttribute('title', `Can't add more than 3 slots.`);
    return;
  };

  addSlotBtn ? enableElement(addSlotBtn) : undefined;
  addSlotBtn?.removeAttribute('title');
};

function handleConfirmBtnState(): void {
  const confirmBtn: HTMLButtonElement | null = document.querySelector('#time-picker-confirm');

  if (timePickerState.slots.length === 0) {
    confirmBtn ? disableElement(confirmBtn) : undefined;
    return;
  };

  confirmBtn ? enableElement(confirmBtn) : undefined;
};

function disableElement(element: HTMLElement): void {
  element.setAttribute('disabled', '');
  element.classList.add('disabled');
};

function enableElement(element: HTMLElement): void {
  element.removeAttribute('disabled');
  element.classList.remove('disabled');
};

function clearInputs(): void {
  const fromInput: HTMLInputElement | null = document.querySelector('#time-picker-from');
  const toInput: HTMLInputElement | null = document.querySelector('#time-picker-to');

  fromInput ? fromInput.value = '' : undefined;
  toInput ? toInput.value = '' : undefined;

  if (timePickerState.slots.length !== timePickerState.maxTimeSlots) {
    fromInput?.focus();
  };
};

function getTimeNumber(time: string): number {
  return +(time.split(':').join(''));;
};

function dispatchSelectedSlots(): void {
  const slotsPickedEvent: CustomEvent = new CustomEvent<TimeSlot[]>('timeSlotsPicked', { detail: timePickerState.slots });
  window.dispatchEvent(slotsPickedEvent);
};