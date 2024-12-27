import { dayMilliseconds } from "../../global/clientConstants";
import popup from "../../global/popup";
import { globalHangoutState } from "../globalHangoutState";
import { hangoutAvailabilityState } from "./hangoutAvailability";

interface AvailabilityCalendarState {
  isActive: boolean,
  data: null | {
    conclusionTimestamp: number,
    conclusionDate: number,

    initialMonth: number,
    initialYear: number,

    currentMonth: number,
    currentYear: number,
  },
};

let availabilityCalendarState: AvailabilityCalendarState = {
  isActive: false,
  data: null,
};

export function initAvailabilityCalendar(hangoutConclusionTimestamp: number): void {
  if (availabilityCalendarState.isActive) {
    return;
  };

  const dateObj: Date = new Date(hangoutConclusionTimestamp);

  availabilityCalendarState = {
    isActive: true,
    data: {
      conclusionTimestamp: hangoutConclusionTimestamp,
      conclusionDate: dateObj.getDate(),

      initialMonth: dateObj.getMonth(),
      initialYear: dateObj.getFullYear(),

      currentMonth: dateObj.getMonth(),
      currentYear: dateObj.getFullYear(),
    },
  };

  updateCalendar();

  const availabilityCalendarHeader: HTMLDivElement | null = document.querySelector('#availability-calendar-header');
  availabilityCalendarHeader?.addEventListener('click', navigateCalendar);
};

function updateCalendar(): void {
  if (!availabilityCalendarState.data) {
    return;
  };

  const { currentMonth, currentYear } = availabilityCalendarState.data;

  const tempDateObj: Date = new Date(currentYear, currentMonth, 1);

  const firstDayOfMonth: number = tempDateObj.getDay();
  const numberOfDays: number = getMonthNumberOfDays(currentMonth, currentYear);
  const monthName: string = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(tempDateObj);

  const availabilityCalendarMonth: HTMLSpanElement | null = document.querySelector('#availability-calendar-month');
  availabilityCalendarMonth && (availabilityCalendarMonth.textContent = monthName);

  const availabilityCalendarYear: HTMLSpanElement | null = document.querySelector('#availability-calendar-year');
  availabilityCalendarYear && (availabilityCalendarYear.textContent = `${currentYear}`);

  const availabilityCalendarDates: HTMLDivElement | null = document.querySelector('#availability-calendar-dates');

  if (!availabilityCalendarDates) {
    availabilityCalendarState = {
      isActive: false,
      data: null,
    };

    popup('Something went wrong.', 'error');
    return;
  };

  const availabilityCalendarDatesContainer: HTMLDivElement = document.createElement('div');
  availabilityCalendarDatesContainer.id = 'availability-calendar-dates-container';

  generateAndAppendEmptyCalendarCells(availabilityCalendarDatesContainer, firstDayOfMonth);
  generateAndAppendCalendarCells(availabilityCalendarDatesContainer, numberOfDays);

  availabilityCalendarDates.firstElementChild?.remove();
  availabilityCalendarDates.appendChild(availabilityCalendarDatesContainer);

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
  const largestRelevantTimestamp: number = new Date(currentYear, currentMonth, getMonthNumberOfDays(currentMonth, currentYear), 23, 59).getTime();

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
  if (!(e.target instanceof HTMLElement)) {
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

    updateCalendar();
    return;
  };

  availabilityCalendarState.data.currentMonth = currentMonth - 1;

  (currentMonth - 1 === initialMonth) && disableCalendarNavigationBtn('backwards');
  enableCalendarNavigationBtn('forwards');

  updateCalendar();
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

    updateCalendar();
    return;
  };

  availabilityCalendarState.data.currentMonth = currentMonth + 1;

  (currentMonthTimestamp + (dayMilliseconds * 31) >= furthestPossibleTimestamp) && disableCalendarNavigationBtn('forwards');
  enableCalendarNavigationBtn('backwards');

  updateCalendar();
};

function disableCalendarNavigationBtn(direction: 'forwards' | 'backwards'): void {
  const navigationBtn: HTMLButtonElement | null = document.querySelector(`#availability-calendar-${direction}-btn`);
  navigationBtn && navigationBtn.classList.add('disabled');
};

function enableCalendarNavigationBtn(direction: 'forwards' | 'backwards'): void {
  const navigationBtn: HTMLButtonElement | null = document.querySelector(`#availability-calendar-${direction}-btn`);
  navigationBtn && navigationBtn.classList.remove('disabled');
};

function generateAndAppendEmptyCalendarCells(container: HTMLDivElement, firstDayOfMonth: number): void {
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

function createCalendarCell(date: number, forbidden: boolean = false): HTMLButtonElement {
  const dateCell: HTMLButtonElement = document.createElement('button');
  dateCell.className = 'date-cell';
  dateCell.setAttribute('type', 'button');
  dateCell.setAttribute('data-value', `${date}`);
  dateCell.appendChild(document.createTextNode(`${date}`));

  if (forbidden) {
    dateCell.classList.add('forbidden');
  };

  return dateCell;
};


function getMonthNumberOfDays(month: number, year: number): number {
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