import { dayMilliseconds, hourMilliseconds } from "../global/clientConstants";
import { createBtnElement, createDivElement } from "../global/domUtils";
import ErrorSpan from "../global/ErrorSpan";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { getDateOrdinalSuffix, getMonthName, getTime } from "../global/dateTimeUtils";
import { globalHangoutState } from "./globalHangoutState";

interface DateTimePickerState {
  hasBeenInitiated: boolean,
  isActive: boolean,

  data: null | {
    purpose: 'availabilitySlot' | 'suggestionSlot',
    existingSlotId: number | null,

    conclusionDate: number,

    initialYear: number,
    initialMonth: number,

    currentYear: number,
    currentMonth: number,
    selectedDate: number | null,

    currentStage: 'date' | 'time',
    timeSlotExtended: boolean,
  },
};

let dateTimePickerState: DateTimePickerState = {
  hasBeenInitiated: false,
  isActive: false,

  data: null,
};

export function displayDateTimePicker(purpose: 'availabilitySlot' | 'suggestionSlot', existingSlotId: number | null = null): void {
  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    return;
  };

  const hangoutConclusionTimestamp: number = globalHangoutState.data.conclusionTimestamp;
  const dateTimePicker: HTMLDivElement | null = document.querySelector('#date-time-picker');

  if (!dateTimePicker) {
    popup('Something went wrong.', 'error');
    return;
  };

  const dateObj: Date = new Date(hangoutConclusionTimestamp);

  const conclusionDate: number = dateObj.getDate();
  const conclusionMonth: number = dateObj.getMonth();
  const conclusionYear: number = dateObj.getFullYear();

  const isFirstInit: boolean = dateTimePickerState.hasBeenInitiated === false;

  dateTimePickerState = {
    hasBeenInitiated: true,
    isActive: true,

    data: {
      purpose,
      existingSlotId,

      conclusionDate,

      initialMonth: conclusionMonth,
      initialYear: conclusionYear,

      currentMonth: conclusionMonth,
      currentYear: conclusionYear,
      selectedDate: null,

      currentStage: 'date',
      timeSlotExtended: false,
    },
  };

  updateCalendar();

  dateTimePicker.style.display = 'flex';
  dateTimePicker.focus();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dateTimePicker.classList.add('revealed');
    });
  });

  if (isFirstInit) {
    loadEventListeners();
  };
};

const dateTimePickerElement: HTMLDivElement | null = document.querySelector('#date-time-picker');

const datePickerHeader: HTMLDivElement | null = document.querySelector('#date-picker-header');
const datePickerDates: HTMLDivElement | null = document.querySelector('#date-picker-dates');
const datePickerCancelBtn: HTMLButtonElement | null = document.querySelector('#date-picker-cancel-btn');

const timePickerForm: HTMLFormElement | null = document.querySelector('#time-picker-form');
const timePickerSlotStartInput: HTMLInputElement | null = document.querySelector('#time-picker-slot-start');
const timePickerSlotEndInput: HTMLInputElement | null = document.querySelector('#time-picker-slot-end');
const timePickerChangeDateBtn: HTMLButtonElement | null = document.querySelector('#time-picker-change-date-btn');
const timePickerCancelBtn: HTMLButtonElement | null = document.querySelector('#time-picker-cancel-btn');
const timePickerExtendSlotCheckbox: HTMLButtonElement | null = document.querySelector('#extend-slot-end-btn');

function loadEventListeners(): void {
  datePickerHeader?.addEventListener('click', navigateDatePicker);
  datePickerDates?.addEventListener('click', selectDate);

  timePickerForm?.addEventListener('submit', submitDateAndTime);

  datePickerCancelBtn?.addEventListener('click', closeDateTimePicker);
  timePickerCancelBtn?.addEventListener('click', closeDateTimePicker);
  timePickerChangeDateBtn?.addEventListener('click', regressStage);
  timePickerExtendSlotCheckbox?.addEventListener('click', toggleSlotEndExtension);
};

function submitDateAndTime(e: SubmitEvent): void {
  e.preventDefault();
  LoadingModal.display();

  if (!dateTimePickerState.isActive) {
    LoadingModal.remove();
    return;
  };

  if (!dateTimePickerState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const { currentStage, currentYear, currentMonth, selectedDate, timeSlotExtended, purpose, existingSlotId } = dateTimePickerState.data;

  if (currentStage !== 'time' || !selectedDate) {
    popup('Must provide a date first.', 'error');
    LoadingModal.remove();

    regressStage();
    return;
  };

  if (!timePickerSlotStartInput || !timePickerSlotEndInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidSlotStart: boolean = validateTimeSlotInput(timePickerSlotStartInput);
  const isValidSlotEnd: boolean = validateTimeSlotInput(timePickerSlotEndInput);

  if (!isValidSlotStart || !isValidSlotEnd) {
    popup('Invalid time slot.', 'error');
    LoadingModal.remove();

    return;
  };

  const slotStartString: string = timePickerSlotStartInput.value;
  const slotEndString: string = timePickerSlotEndInput.value;

  const slotStartArr: string[] = slotStartString.split(':');
  const slotEndArr: string[] = slotEndString.split(':');

  const slotStartHours: number | null = slotStartArr[0] ? +slotStartArr[0] : null;
  const slotStartMinutes: number | null = slotStartArr[1] ? +slotStartArr[1] : null;

  if (slotStartHours === null || slotStartMinutes === null) {
    return;
  };

  const slotEndHours: number | null = slotEndArr[0] ? +slotEndArr[0] : null;
  const slotEndMinutes: number | null = slotEndArr[1] ? +slotEndArr[1] : null;

  if (slotEndHours === null || slotEndMinutes === null) {
    return;
  };

  const startTimestamp: number = new Date(currentYear, currentMonth, selectedDate, slotStartHours, slotStartMinutes).getTime();
  const endTimestamp: number = new Date(currentYear, currentMonth, (timeSlotExtended ? selectedDate + 1 : selectedDate), slotEndHours, slotEndMinutes).getTime();

  if (!isValidTimeSlot(startTimestamp, endTimestamp)) {
    popup('Invalid time slot.', 'error');
    LoadingModal.remove();

    return;
  };

  if (slotStartsBeforeHangoutConclusion(startTimestamp)) {
    popup('Invalid time slot start.', 'error');
    LoadingModal.remove();

    return;
  };

  document.dispatchEvent(new CustomEvent<DateTimePickerData>(`dateTimePicker-selection`, {
    detail: { purpose, existingSlotId, startTimestamp, endTimestamp },
  }));

  if (purpose === 'suggestionSlot') {
    closeDateTimePicker();
    LoadingModal.remove();
  };
};

function selectDate(e: MouseEvent): void {
  if (!dateTimePickerState.data) {
    return;
  };

  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.classList.contains('forbidden')) {
    return;
  };

  const selectedDate: string | null = e.target.getAttribute('data-value');
  if (!selectedDate || !isValidSelectedDate(+selectedDate)) {
    popup('Invalid date.', 'error');
    return;
  };

  dateTimePickerState.data.selectedDate = +selectedDate;
  progressStage();
};

export function switchToDateTimePicker(selectedDateTimestamp: number): void {
  displayDateTimePicker('availabilitySlot');

  if (!dateTimePickerState.data) {
    popup('Something went wrong.', 'error');
    closeDateTimePicker();

    return;
  };

  const selectedDateObj: Date = new Date(selectedDateTimestamp);

  dateTimePickerState.data.currentMonth = selectedDateObj.getMonth();
  dateTimePickerState.data.currentYear = selectedDateObj.getFullYear();
  dateTimePickerState.data.selectedDate = selectedDateObj.getDate();

  updateCalendar();
  progressStage();
};

function progressStage(): void {
  if (!dateTimePickerState.data) {
    return;
  };

  const { currentYear, currentMonth, selectedDate } = dateTimePickerState.data;

  if (!selectedDate) {
    return;
  };

  dateTimePickerState.data.currentStage = 'time';
  const dateObj: Date = new Date(currentYear, currentMonth);

  const timePickerSelectedDateSpan: HTMLSpanElement | null = document.querySelector('#time-picker-selected-date');
  timePickerSelectedDateSpan && (timePickerSelectedDateSpan.textContent = `${getMonthName(dateObj)} ${selectedDate}${getDateOrdinalSuffix(selectedDate)}, ${currentYear}.`);

  dateTimePickerElement?.setAttribute('data-stage', 'time');
};

function regressStage(): void {
  if (!dateTimePickerState.data) {
    return;
  };

  dateTimePickerState.data.currentStage = 'date';
  dateTimePickerState.data.selectedDate = null;

  dateTimePickerElement?.setAttribute('data-stage', 'date');
};

export function closeDateTimePicker(): void {
  dateTimePickerState.isActive = false;

  if (!dateTimePickerElement) {
    return;
  };

  dateTimePickerElement.classList.remove('revealed');

  setTimeout(() => {
    dateTimePickerElement.style.display = 'none';
    resetDateTimePicker();
  }, 150);
};

function resetDateTimePicker(): void {
  dateTimePickerState.data = null;

  dateTimePickerElement?.setAttribute('data-stage', 'date');
  timePickerExtendSlotCheckbox?.classList.remove('checked');

  const timePickerSelectedDateSpan: HTMLSpanElement | null = document.querySelector('#time-picker-selected-date');
  timePickerSelectedDateSpan && (timePickerSelectedDateSpan.textContent = '');

  if (!timePickerSlotStartInput || !timePickerSlotEndInput) {
    return;
  };

  timePickerSlotStartInput.value = '';
  timePickerSlotEndInput.value = '';

  ErrorSpan.hide(timePickerSlotStartInput);
  ErrorSpan.hide(timePickerSlotEndInput);
};

function toggleSlotEndExtension(): void {
  if (!dateTimePickerState.data || !timePickerExtendSlotCheckbox) {
    return;
  };

  dateTimePickerState.data.timeSlotExtended = !dateTimePickerState.data.timeSlotExtended;
  timePickerExtendSlotCheckbox.classList.toggle('checked');
};

function isValidSelectedDate(selectedDate: number): boolean {
  if (!Number.isInteger(selectedDate)) {
    return false;
  };

  if (!dateTimePickerState.data) {
    return false;
  };

  const { currentYear, currentMonth, initialYear, initialMonth, conclusionDate } = dateTimePickerState.data;

  const monthLimitReached: boolean = new Date(initialYear, initialMonth + 6).getMonth() === currentMonth;
  const furthestPossibleDate: number | null = monthLimitReached ? new Date(initialYear, initialMonth + 6, conclusionDate).getDate() : null;
  const isFirstAvailableMonth: boolean = currentMonth === initialMonth;

  if ((furthestPossibleDate && selectedDate > furthestPossibleDate) || (isFirstAvailableMonth && selectedDate < conclusionDate)) {
    return false;
  };

  if (!isValidDateValue(currentYear, currentMonth, selectedDate)) {
    return false;
  };

  return true;
};

function isValidDateValue(currentYear: number, currentMonth: number, date: number): boolean {
  const maxValue: number = getMonthNumberOfDays(currentYear, currentMonth);
  if (date > maxValue || date < 1) {
    return false;
  };

  return true;
};

function isValidTimeSlot(startTimestamp: number, endTimestamp: number): boolean {
  if (!timePickerSlotEndInput) {
    return false;
  };

  if (endTimestamp < startTimestamp) {
    ErrorSpan.display(timePickerSlotEndInput, `Time slot can't end before its start.`);
    return false;
  };

  if (endTimestamp - startTimestamp < hourMilliseconds) {
    ErrorSpan.display(timePickerSlotEndInput, `Time slot can't be shorter than an hour.`);
    return false;
  };

  if (endTimestamp - startTimestamp > dayMilliseconds) {
    ErrorSpan.display(timePickerSlotEndInput, `Time slot can't be longer than 24 hours.`);
    return false;
  };

  return true;
};

function slotStartsBeforeHangoutConclusion(startTimestamp: number): boolean {
  if (!globalHangoutState.data) {
    return false;
  };

  const hangoutConclusionTimestamp: number = globalHangoutState.data.conclusionTimestamp;

  if (startTimestamp <= hangoutConclusionTimestamp) {
    const minimumTimeString: string = getTime(new Date(hangoutConclusionTimestamp));
    timePickerSlotStartInput && ErrorSpan.display(timePickerSlotStartInput, `Time slot must start after ${minimumTimeString} if added on the hangout conclusion date.`);

    return true;
  };

  return false;
};

function validateTimeSlotInput(input: HTMLInputElement): boolean {
  if (!isValidTimeSlotString(input.value)) {
    ErrorSpan.display(input, 'Invalid 24-hour time format (HH:MM).');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

function isValidTimeSlotString(slotString: string): boolean {
  const timeRegex: RegExp = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return timeRegex.test(slotString);
};

// --- --- ---

function updateCalendar(): void {
  if (!dateTimePickerState.data) {
    return;
  };

  const { currentYear, currentMonth } = dateTimePickerState.data;
  const dateObj: Date = new Date(currentYear, currentMonth, 1);

  const firstDayOfMonth: number = dateObj.getDay();
  const numberOfDays: number = getMonthNumberOfDays(currentYear, currentMonth);
  const monthName: string = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(dateObj);

  const datePickerHeaderTitle: HTMLParagraphElement | null = document.querySelector('#date-picker-header-title');
  datePickerHeaderTitle && (datePickerHeaderTitle.textContent = `${monthName} ${currentYear}`);

  const datePickerDates: HTMLDivElement | null = document.querySelector('#date-picker-dates');

  if (!datePickerDates) {
    dateTimePickerState.data = null;
    popup('Something went wrong.', 'error');

    return;
  };

  const datePickerDatesContainer: HTMLDivElement = createDivElement(null, 'date-picker-dates-container');

  generateAndAppendEmptyCalendarCells(datePickerDatesContainer, firstDayOfMonth);
  generateAndAppendCalendarCells(datePickerDatesContainer, numberOfDays);

  datePickerDates.firstElementChild?.remove();
  datePickerDates.appendChild(datePickerDatesContainer);
};

export function generateAndAppendEmptyCalendarCells(container: HTMLDivElement, firstDayOfMonth: number): void {
  if (firstDayOfMonth === 0) {
    for (let i = 0; i < 6; i++) {
      container.appendChild(createEmptyCalendarCell());
    };

    return;
  };

  for (let i = 0; i < firstDayOfMonth - 1; i++) {
    container.appendChild(createEmptyCalendarCell());
  };
};

function createEmptyCalendarCell(): HTMLSpanElement {
  const emptyCell: HTMLSpanElement = document.createElement('span');
  emptyCell.className = 'date-item empty';

  return emptyCell;
};

function generateAndAppendCalendarCells(container: HTMLDivElement, numberOfDays: number): void {
  if (!dateTimePickerState.data) {
    return;
  };

  const { currentMonth, initialYear, initialMonth, conclusionDate } = dateTimePickerState.data;

  const monthLimitReached: boolean = new Date(initialYear, initialMonth + 6).getMonth() === currentMonth;
  const furthestPossibleDate: number | null = monthLimitReached ? new Date(initialYear, initialMonth + 6, conclusionDate).getDate() : null;
  const isFirstAvailableMonth: boolean = currentMonth === initialMonth;

  for (let i = 1; i <= numberOfDays; i++) {
    if ((furthestPossibleDate && i > furthestPossibleDate) || (isFirstAvailableMonth && i < conclusionDate)) {
      container.appendChild(createCalendarCell(i, true));
      continue;
    };

    container.appendChild(createCalendarCell(i));
  };
};

export function createCalendarCell(date: number, forbidden: boolean = false): HTMLButtonElement {
  const dateCell: HTMLButtonElement = createBtnElement('date-cell', `${date}`);
  dateCell.setAttribute('data-value', `${date}`);

  if (forbidden) {
    dateCell.classList.add('forbidden');
    dateCell.disabled = true;
  };

  return dateCell;
};

function navigateDatePicker(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'date-picker-backwards-btn') {
    navigateBackwards();
    return;
  };

  if (e.target.id === 'date-picker-forwards-btn') {
    navigateForwards();
  };
};

function navigateBackwards(): void {
  if (!dateTimePickerState.data) {
    return;
  };

  const { currentYear, currentMonth, initialMonth } = dateTimePickerState.data;

  if (currentMonth === initialMonth) {
    return;
  };

  if (currentMonth === 0) {
    dateTimePickerState.data.currentMonth = 11;
    dateTimePickerState.data.currentYear = currentYear - 1;

    (initialMonth === 11) && disableCalendarNavigationBtn('backwards');
    enableCalendarNavigationBtn('forwards');

    updateCalendar();
    return;
  };

  dateTimePickerState.data.currentMonth = currentMonth - 1;

  (currentMonth - 1 === initialMonth) && disableCalendarNavigationBtn('backwards');
  enableCalendarNavigationBtn('forwards');

  updateCalendar();
};

function navigateForwards(): void {
  if (!dateTimePickerState.data) {
    return;
  };

  const { currentYear, currentMonth, initialYear, initialMonth, conclusionDate } = dateTimePickerState.data;

  const currentMonthTimestamp: number = new Date(currentYear, currentMonth, conclusionDate).getTime();
  const furthestPossibleTimestamp: number = new Date(initialYear, initialMonth + 6, conclusionDate).getTime();

  if (currentMonthTimestamp >= furthestPossibleTimestamp) {
    return;
  };

  if (currentMonth === 11) {
    dateTimePickerState.data.currentMonth = 0;
    dateTimePickerState.data.currentYear = currentYear + 1;

    (currentMonthTimestamp + (dayMilliseconds * 30) >= furthestPossibleTimestamp) && disableCalendarNavigationBtn('forwards');
    enableCalendarNavigationBtn('backwards');

    updateCalendar();
    return;
  };

  dateTimePickerState.data.currentMonth = currentMonth + 1;

  (currentMonthTimestamp + (dayMilliseconds * 31) >= furthestPossibleTimestamp) && disableCalendarNavigationBtn('forwards');
  enableCalendarNavigationBtn('backwards');

  updateCalendar();
};

function disableCalendarNavigationBtn(direction: 'forwards' | 'backwards'): void {
  const navigationBtn: HTMLButtonElement | null = document.querySelector(`#date-picker-${direction}-btn`);
  navigationBtn && navigationBtn.classList.add('disabled');
};

function enableCalendarNavigationBtn(direction: 'forwards' | 'backwards'): void {
  const navigationBtn: HTMLButtonElement | null = document.querySelector(`#date-picker-${direction}-btn`);
  navigationBtn && navigationBtn.classList.remove('disabled');
};

export function getMonthNumberOfDays(year: number, month: number): number {
  if (month === 1) {
    return getFebNumberOfDays(year);
  };

  const shortMonths: number[] = [3, 5, 8, 10];

  const isShortMonth: boolean = shortMonths.includes(month);
  if (isShortMonth) {
    return 30;
  };

  return 31;
};

function getFebNumberOfDays(year: number): number {
  const isDivisibleByFour: boolean = year % 4 === 0;
  const isDivisibleByHundred: boolean = year % 100 === 0;
  const isDivisibleByFourHundred: boolean = year % 400 === 0;

  if (isDivisibleByFour && (!isDivisibleByHundred || isDivisibleByFourHundred)) {
    return 29;
  };

  return 28;
};

// --- --- ---

export interface DateTimePickerEvent extends CustomEvent {
  detail: DateTimePickerData
};

export interface DateTimePickerData {
  purpose: 'availabilitySlot' | 'suggestionSlot',
  existingSlotId: number | null,
  startTimestamp: number,
  endTimestamp: number,
};

export function isValidDateTimePickerEvent(event: unknown): event is DateTimePickerEvent {
  if (!(event instanceof CustomEvent)) {
    return false;
  };

  if (!('detail' in event) || typeof event.detail !== 'object' || event.detail === null) {
    return false;
  };

  if (!('purpose' in event.detail) || !('startTimestamp' in event.detail) || !('endTimestamp' in event.detail)) {
    return false;
  };

  const { purpose, startTimestamp, endTimestamp } = event.detail;

  if (typeof purpose !== 'string' || typeof startTimestamp !== 'number' || typeof endTimestamp !== 'number') {
    return false;
  };

  if (purpose !== 'availabilitySlot' && purpose !== 'suggestionSlot') {
    return false;
  };

  return true;
};

export function displayTimePickerError(message: string, inputElementIdEnding: 'start' | 'end' = 'end'): void {
  if (!dateTimePickerState.isActive) {
    return;
  };

  const input: HTMLInputElement | null = document.querySelector(`#time-picker-slot-${inputElementIdEnding}`);
  input && ErrorSpan.display(input, message);
};