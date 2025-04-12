import { dayMilliseconds } from "../../global/clientConstants";
import popup from "../../global/popup";
import { globalHangoutState } from "../globalHangoutState";
import { createCalendarCell, generateAndAppendEmptyCalendarCells, getMonthNumberOfDays } from "../dateTimePicker";
import { hangoutAvailabilityState } from "./hangoutAvailability";
import { displayAvailabilityPreviewer } from "./availabilityPreviewer";
import { createDivElement } from "../../global/domUtils";

interface AvailabilityCalendarState {
  hasBeenInitiated: boolean,
  data: null | {
    conclusionDate: number,

    initialMonth: number,
    initialYear: number,

    currentMonth: number,
    currentYear: number,
  },
};

export const availabilityCalendarState: AvailabilityCalendarState = {
  hasBeenInitiated: false,
  data: null,
};

const availabilityCalendarDatesElement: HTMLDivElement | null = document.querySelector('#availability-calendar-dates');
const availabilityCalendarHeader: HTMLDivElement | null = document.querySelector('#availability-calendar-header');

export function initAvailabilityCalendar(): void {
  if (availabilityCalendarState.hasBeenInitiated) {
    return;
  };

  if (!globalHangoutState.data) {
    popup('Something went wrong.', 'error');
    return;
  };

  const dateObj: Date = new Date(globalHangoutState.data.conclusionTimestamp);

  availabilityCalendarState.hasBeenInitiated = true;
  availabilityCalendarState.data = {
    conclusionDate: dateObj.getDate(),

    initialMonth: dateObj.getMonth(),
    initialYear: dateObj.getFullYear(),

    currentMonth: dateObj.getMonth(),
    currentYear: dateObj.getFullYear(),
  };

  updateAvailabilityCalendar();

  availabilityCalendarHeader?.addEventListener('click', navigateCalendar);
  availabilityCalendarDatesElement?.addEventListener('click', handleCalendarCellClick);
};

export function updateAvailabilityCalendar(): void {
  if (!availabilityCalendarState.data) {
    return;
  };

  const { currentMonth, currentYear } = availabilityCalendarState.data;
  const dateObj: Date = new Date(currentYear, currentMonth, 1);

  const firstDayOfMonth: number = dateObj.getDay();
  const numberOfDays: number = getMonthNumberOfDays(currentYear, currentMonth);
  const monthName: string = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(dateObj);

  const availabilityCalendarTitle: HTMLParagraphElement | null = document.querySelector('#availability-calendar-title');
  availabilityCalendarTitle && (availabilityCalendarTitle.textContent = `${monthName} ${currentYear}`);

  if (!availabilityCalendarDatesElement) {
    availabilityCalendarState.hasBeenInitiated = false;
    availabilityCalendarState.data = null;

    popup('Something went wrong.', 'error');
    return;
  };

  const availabilityCalendarDatesContainer: HTMLDivElement = createDivElement(null, 'availability-calendar-dates-container');

  generateAndAppendEmptyCalendarCells(availabilityCalendarDatesContainer, firstDayOfMonth);
  generateAndAppendCalendarCells(availabilityCalendarDatesContainer, numberOfDays);

  availabilityCalendarDatesElement.firstElementChild?.remove();
  availabilityCalendarDatesElement.appendChild(availabilityCalendarDatesContainer);

  displayAvailabilityMarkers();
};

function displayAvailabilityMarkers(): void {
  if (hangoutAvailabilityState.availabilitySlots.length === 0) {
    return;
  };

  if (!availabilityCalendarState.data) {
    return;
  };

  const { currentYear, currentMonth } = availabilityCalendarState.data;

  const smallestRelevantTimestamp: number = new Date(currentYear, currentMonth, 1).getTime();
  const largestRelevantTimestamp: number = new Date(currentYear, currentMonth, getMonthNumberOfDays(currentYear, currentMonth), 23, 59).getTime();

  const uniqueSlots: { memberId: number, date: number }[] = [];
  const monthSpecificSlotsMap: Map<number, number> = new Map();

  for (const slot of hangoutAvailabilityState.availabilitySlots) {
    if (slot.slot_start_timestamp < smallestRelevantTimestamp || slot.slot_start_timestamp > largestRelevantTimestamp) {
      continue;
    };

    const date: number = new Date(slot.slot_start_timestamp).getDate();

    if (uniqueSlots.some((uniqueSlot) => uniqueSlot.memberId === slot.hangout_member_id && uniqueSlot.date === date)) {
      continue;
    };

    uniqueSlots.push({ memberId: slot.hangout_member_id, date });

    const dateCount: number | undefined = monthSpecificSlotsMap.get(date);
    monthSpecificSlotsMap.set(date, dateCount ? (dateCount + 1) : 1);
  };

  if (!globalHangoutState.data) {
    return;
  };

  const { hangoutMemberId, hangoutMembers } = globalHangoutState.data;

  const calendarCells: NodeListOf<HTMLButtonElement> = document.querySelectorAll('button.date-cell');

  for (const cell of calendarCells) {
    const date: string | null = cell.getAttribute('data-value');
    if (!date) {
      continue;
    };

    const slotsCount: number | undefined = monthSpecificSlotsMap.get(+date);
    if (!slotsCount) {
      continue;
    };

    const availabilityPercentage: number = slotsCount / hangoutMembers.length;
    let className: string = '';

    if (availabilityPercentage < 0.3) {
      className = 'low-availability';
    } else if (availabilityPercentage >= 0.3 && availabilityPercentage <= 0.6) {
      className = 'medium-availability';
    } else {
      className = 'high-availability';
    };

    cell.classList.add(className);

    if (uniqueSlots.some((slot) => slot.memberId === hangoutMemberId)) {
      cell.classList.add('self-availability');
    };
  };
};

function navigateCalendar(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'availability-calendar-backwards-btn') {
    navigateBackwards();
    return;
  };

  if (e.target.id === 'availability-calendar-forwards-btn') {
    navigateForwards();
  };
};

function navigateBackwards(): void {
  if (!availabilityCalendarState.data) {
    return;
  };

  const { currentMonth, currentYear, initialMonth } = availabilityCalendarState.data;

  if (currentMonth === initialMonth) {
    return;
  };

  if (currentMonth === 0) {
    availabilityCalendarState.data.currentMonth = 11;
    availabilityCalendarState.data.currentYear = currentYear - 1;

    (initialMonth === 11) && disableCalendarNavigationBtn('backwards');
    enableCalendarNavigationBtn('forwards');

    updateAvailabilityCalendar();
    return;
  };

  availabilityCalendarState.data.currentMonth = currentMonth - 1;

  (currentMonth - 1 === initialMonth) && disableCalendarNavigationBtn('backwards');
  enableCalendarNavigationBtn('forwards');

  updateAvailabilityCalendar();
};

function navigateForwards(): void {
  if (!availabilityCalendarState.data) {
    return;
  };

  const { currentMonth, currentYear, initialMonth, initialYear, conclusionDate } = availabilityCalendarState.data;

  const currentMonthTimestamp: number = new Date(currentYear, currentMonth, conclusionDate).getTime();
  const furthestPossibleTimestamp: number = new Date(initialYear, initialMonth + 6, conclusionDate).getTime();

  if (currentMonthTimestamp >= furthestPossibleTimestamp) {
    return;
  };

  if (currentMonth === 11) {
    availabilityCalendarState.data.currentMonth = 0;
    availabilityCalendarState.data.currentYear = currentYear + 1;

    (currentMonthTimestamp + (dayMilliseconds * 30) >= furthestPossibleTimestamp) && disableCalendarNavigationBtn('forwards');
    enableCalendarNavigationBtn('backwards');

    updateAvailabilityCalendar();
    return;
  };

  availabilityCalendarState.data.currentMonth = currentMonth + 1;

  (currentMonthTimestamp + (dayMilliseconds * 31) >= furthestPossibleTimestamp) && disableCalendarNavigationBtn('forwards');
  enableCalendarNavigationBtn('backwards');

  updateAvailabilityCalendar();
};

function disableCalendarNavigationBtn(direction: 'forwards' | 'backwards'): void {
  const navigationBtn: HTMLButtonElement | null = document.querySelector(`#availability-calendar-${direction}-btn`);
  navigationBtn && navigationBtn.classList.add('disabled');
};

function enableCalendarNavigationBtn(direction: 'forwards' | 'backwards'): void {
  const navigationBtn: HTMLButtonElement | null = document.querySelector(`#availability-calendar-${direction}-btn`);
  navigationBtn && navigationBtn.classList.remove('disabled');
};

function generateAndAppendCalendarCells(container: HTMLDivElement, numberOfDays: number): void {
  if (!availabilityCalendarState.data) {
    return;
  };

  const { currentMonth, initialMonth, initialYear, conclusionDate } = availabilityCalendarState.data;

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

function handleCalendarCellClick(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  const selectedDateString: string | null = e.target.getAttribute('data-value');

  if (!selectedDateString) {
    return;
  };

  const selectedDate: number = +selectedDateString;

  if (!Number.isInteger(selectedDate)) {
    return;
  };

  if (!availabilityCalendarState.data) {
    return;
  };

  const { currentYear, currentMonth } = availabilityCalendarState.data;
  const selectedDateTimestamp: number = new Date(currentYear, currentMonth, selectedDate).getTime();

  displayAvailabilityPreviewer(selectedDateTimestamp);
};

export function resetAvailabilityCalendar(): void {
  availabilityCalendarState.hasBeenInitiated = false;
  availabilityCalendarState.data = null;

  initAvailabilityCalendar();
};