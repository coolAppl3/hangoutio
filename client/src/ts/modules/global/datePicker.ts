interface DatePickerState {
  initialYear: number;
  initialMonth: number;
  initialDate: number;
  initialMonthName: string;

  year: number;
  month: number;
  monthName: string;

  selectedDate?: number;
  selectedMonth?: number;
  selectedYear?: number;
};

const date: Date = new Date();

const datePickerState: DatePickerState = {
  initialYear: date.getFullYear(),
  initialMonth: date.getMonth(),
  initialDate: date.getDate(),
  initialMonthName: new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date),

  year: date.getFullYear(),
  month: date.getMonth(),
  monthName: new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date),

  selectedDate: undefined,
  selectedMonth: undefined,
  selectedYear: undefined,
};

export default function datePicker(): void {
  initDatePicker();
  displayDatePicker();
  loadEventListeners();
};

function loadEventListeners(): void {
  const datePickerNavbar: HTMLDivElement | null = document.querySelector('#date-picker-navbar');
  datePickerNavbar?.addEventListener('click', handleNavigation);

  const datePickerDates: HTMLDivElement | null = document.querySelector('#date-picker-dates');
  datePickerDates?.addEventListener('click', selectDate);

  const datePickerBtnContainer: HTMLDivElement | null = document.querySelector('#date-picker-btn-container');
  datePickerBtnContainer?.addEventListener('click', handleSubmission);
};

function render(): void {
  handleNavButtonsVisibility();
  handleConfirmBtnState();
  highlightInitialDate();
  highlightSelectedDateIfVisible();
};

function updateCurrentDateState(): void {
  datePickerState.year = date.getFullYear();
  datePickerState.month = date.getMonth();
  datePickerState.monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);
};

function updateDates(): void {
  const monthDays: number = getMonthNumberOfDays(datePickerState.month, datePickerState.year);
  const monthFirstDate: number = new Date(datePickerState.year, datePickerState.month, 1).getDay();

  const navbarHeader: HTMLParagraphElement | null = document.querySelector('#date-picker-navbar-header');

  const navbarHeaderMonth: Element | null | undefined = navbarHeader?.firstElementChild;
  navbarHeaderMonth && (navbarHeaderMonth.textContent = `${datePickerState.monthName} `);

  const navbarHeaderYearElement: Element | null | undefined = navbarHeader?.lastElementChild;
  navbarHeaderYearElement && (navbarHeaderYearElement.textContent = `${datePickerState.year}`);

  insertDateButtons(monthFirstDate, monthDays);
};

function selectDate(e: MouseEvent): void {
  const clickedBtn: HTMLButtonElement | EventTarget | null = e.target;
  if (clickedBtn instanceof HTMLButtonElement === false || clickedBtn.className !== 'date-picker-date-btn') {
    return;
  };

  const clickedBtnValue: string | null = clickedBtn.getAttribute('data-date-value');
  if (!clickedBtnValue) {
    return;
  };

  let dateValue: number;
  if (isValidDateValue(+clickedBtnValue)) {
    dateValue = +clickedBtnValue;
  } else {
    dateValue = 1;
  };

  datePickerState.selectedDate = dateValue;
  datePickerState.selectedMonth = datePickerState.month;
  datePickerState.selectedYear = datePickerState.year;


  highlightSelectedDate(clickedBtn);
  displaySelectedDateText();
  render();
};

// submission
function handleSubmission(e: MouseEvent): void {
  if (!e.target || e.target instanceof HTMLButtonElement === false) {
    return;
  };

  if (e.target.id === 'date-picker-close') {
    closeDatePicker();
    return;
  };

  if (e.target.id === 'date-picker-confirm') {
    confirmSelectedDate();
  };
};

function closeDatePicker(): void {
  resetGlobalState();
  hideDatePicker();
};

function confirmSelectedDate(): void {
  if (!datePickerState.selectedDate) {
    return;
  };

  dispatchSelectedDate();
  resetGlobalState();
  hideDatePicker();
};

// navigation
function handleNavigation(e: MouseEvent): void {
  if (e.target instanceof HTMLButtonElement === false) {
    return;
  };

  const direction: string = e.target.id.split('date-picker-')[1];

  if (direction === 'back') {
    navigateBackwards();
    return;
  };

  if (direction === 'forward') {
    navigateForwards();
  };
};

function navigateBackwards(): void {
  if (datePickerState.month <= datePickerState.initialMonth) {
    return;
  };

  date.setMonth(date.getMonth() - 1);
  updateCurrentDateState();
  updateDates();
  render();
};

function navigateForwards(): void {
  const monthDifference: number = (datePickerState.month - datePickerState.initialMonth + 12) % 12;
  if (monthDifference >= 2) {
    return;
  };

  date.setMonth(date.getMonth() + 1);
  updateCurrentDateState();
  updateDates();
  render();
};

function handleNavButtonsVisibility(): void {
  const backBtn: HTMLButtonElement | null = document.querySelector('#date-picker-back');
  const forwardBtn: HTMLButtonElement | null = document.querySelector('#date-picker-forward');

  backBtn?.classList.remove('hidden');
  forwardBtn?.classList.remove('hidden');

  if (datePickerState.month <= datePickerState.initialMonth) {
    backBtn?.classList.add('hidden');
  };

  const monthDifference: number = (datePickerState.month - datePickerState.initialMonth + 12) % 12;
  if (monthDifference >= 2) {
    forwardBtn?.classList.add('hidden');
  };
};

// initialization
function initDatePicker(): void {
  const initialMonthDays: number = getMonthNumberOfDays(datePickerState.initialMonth, datePickerState.initialYear);
  const initialMonthFirstDay: number = new Date(datePickerState.initialYear, datePickerState.initialMonth, 1).getDay();

  const navbarHeader: HTMLParagraphElement | null = document.querySelector('#date-picker-navbar-header');

  const navbarHeaderMonthElement: Element | null | undefined = navbarHeader?.firstElementChild;
  navbarHeaderMonthElement && (navbarHeaderMonthElement.textContent = `${datePickerState.initialMonthName} `);

  const navbarHeaderYear: Element | null | undefined = navbarHeader?.lastElementChild;
  navbarHeaderYear && (navbarHeaderYear.textContent = `${datePickerState.initialYear}`);

  insertDateButtons(initialMonthFirstDay, initialMonthDays);
  render();
};

function highlightInitialDate(): void {
  if (datePickerState.initialMonth !== datePickerState.month) {
    return;
  };

  const initialDate: HTMLButtonElement | null = document.querySelector(`[data-date-value="${datePickerState.initialDate}"]`);
  initialDate?.setAttribute('data-initial', 'true');

  initialDate && disablePastDates(initialDate);
};

function highlightSelectedDate(btn: HTMLButtonElement): void {
  const previousSelectedBtn: HTMLButtonElement | null = document.querySelector(`#date-picker-selected-date`);
  previousSelectedBtn?.removeAttribute('id');

  btn.id = 'date-picker-selected-date';
};

function highlightSelectedDateIfVisible(): void {
  if (!datePickerState.selectedDate || datePickerState.selectedMonth !== datePickerState.month) {
    return;
  };

  const selectedBtn: HTMLButtonElement | null = document.querySelector(`[data-date-value="${datePickerState.selectedDate}"]`);
  selectedBtn && (selectedBtn.id = 'date-picker-selected-date');
};

function disablePastDates(initialDate: HTMLElement): void {
  let previousElement: Element | null = initialDate.previousElementSibling;

  while (previousElement instanceof HTMLButtonElement) {
    previousElement.classList.add('disabled');
    previousElement = previousElement.previousElementSibling;
  };
};

// utility
function insertDateButtons(firstDayOfMonth: number, monthNumberOfDays: number): void {
  const dateButtonsParent: HTMLDivElement | null = document.querySelector('#date-picker-dates');

  const previousDateButtonsContainer: Element | null | undefined = dateButtonsParent?.firstElementChild;
  previousDateButtonsContainer?.remove();

  const dateButtonsContainer: HTMLDivElement = document.createElement('div');
  dateButtonsContainer.id = 'date-picker-dates-container';

  for (let i = 0; i < monthNumberOfDays; i++) {
    const activeDateBtn: HTMLButtonElement = createDateBtn('active', i + 1);
    dateButtonsContainer?.appendChild(activeDateBtn);
  };

  let firstDayOfMonthOffset: number;
  if (firstDayOfMonth === 0) {
    firstDayOfMonthOffset = 6;
  } else if (firstDayOfMonth === 6) {
    firstDayOfMonthOffset = 5;
  } else {
    firstDayOfMonthOffset = firstDayOfMonth - 1;
  };

  for (let i = 0; i < firstDayOfMonthOffset; i++) {
    const emptyDateBtn: HTMLElement = createDateBtn('empty');
    dateButtonsContainer?.insertAdjacentElement('afterbegin', emptyDateBtn);
  };

  dateButtonsParent?.appendChild(dateButtonsContainer);
};

function createDateBtn(btnType: 'active' | 'empty', btnValue?: number): HTMLButtonElement {
  if (btnType === 'empty') {
    const emptyBtn: HTMLButtonElement = document.createElement('button');
    emptyBtn.type = 'button';
    emptyBtn.setAttribute('disabled', '');
    emptyBtn.className = 'date-picker-date-empty-btn';

    return emptyBtn;
  };

  const activeBtn: HTMLButtonElement = document.createElement('button');
  activeBtn.type = 'button';
  activeBtn.className = 'date-picker-date-btn';
  activeBtn.setAttribute('data-date-value', `${btnValue}`);
  activeBtn.appendChild(document.createTextNode(`${btnValue}`));

  return activeBtn;
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

  const isDivisibleByFour: boolean = isDivisibleBy(year, 4);
  const isDivisibleByHundred: boolean = isDivisibleBy(year, 100);
  const isDivisibleByFourHundred: boolean = isDivisibleBy(year, 400);

  if (isDivisibleByFour && (!isDivisibleByHundred || isDivisibleByFourHundred)) {
    return 29;
  };

  return 28;
};

function isDivisibleBy(dividend: number, divisor: number): boolean {
  return dividend % divisor === 0;
};

function isValidDateValue(value: number): boolean {
  if (Number.isNaN(value) || !Number.isInteger(value)) {
    return false;
  };

  const maxMonthNumberOfDays = getMonthNumberOfDays(datePickerState.month, datePickerState.year);

  if (value <= 0 || value > maxMonthNumberOfDays) {
    return false;
  };

  return true;
};

function handleConfirmBtnState(): void {
  const confirmBtn: HTMLButtonElement | null = document.querySelector('#date-picker-confirm');

  if (!datePickerState.selectedDate) {
    confirmBtn?.classList.add('disabled');
    confirmBtn?.setAttribute('disabled', '');
    return;
  };

  confirmBtn?.classList.remove('disabled');
  confirmBtn?.removeAttribute('disabled');
};

function displaySelectedDateText(): void {
  const dateText: string = `${datePickerState.monthName} ${datePickerState.selectedDate}, ${datePickerState.selectedYear}`;
  const selectedDateText: HTMLSpanElement | null = document.querySelector('#selected-date-text');

  selectedDateText && (selectedDateText.textContent = dateText);
};

function resetGlobalState(): void {
  resetState();
  resetUIState();
};

function resetState(): void {
  date.setTime(Date.now());

  datePickerState.initialYear = date.getFullYear();
  datePickerState.initialMonth = date.getMonth();
  datePickerState.initialDate = date.getDate();
  datePickerState.initialMonthName = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);

  datePickerState.year = date.getFullYear();
  datePickerState.month = date.getMonth();
  datePickerState.monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);

  datePickerState.selectedDate = undefined;
  datePickerState.selectedMonth = undefined;
  datePickerState.selectedYear = undefined;
};

function resetUIState(): void {
  const datePickerSelectedDate: HTMLButtonElement | null = document.querySelector('#date-picker-selected-date');
  const selectedDateText: HTMLSpanElement | null = document.querySelector('#selected-date-text');

  setTimeout(() => {
    datePickerSelectedDate?.removeAttribute('id');
    selectedDateText && (selectedDateText.textContent = 'None');
  }, 100);

  render();
  updateDates();
  initDatePicker();
};

function dispatchSelectedDate(): void {
  let temporaryDate: Date | null = new Date(datePickerState.selectedYear!, datePickerState.selectedMonth!, datePickerState.selectedDate!);
  const dateTimestamp: number = temporaryDate.getTime();
  temporaryDate = null;

  const dateText: string = `${datePickerState.monthName} ${datePickerState.selectedDate}, ${datePickerState.selectedYear}`;

  const dateInformation: { dateTimestamp: number, dateText: string } = {
    dateTimestamp,
    dateText,
  };

  const dateSelectedEvent: CustomEvent<{ dateTimestamp: number, dateText: string }> = new CustomEvent('datePickerDateSelected', { detail: dateInformation });
  window.dispatchEvent(dateSelectedEvent);
};

function displayDatePicker(): void {
  const datePickerModal: HTMLElement | null = document.querySelector('#date-picker-modal');
  datePickerModal?.classList.add('displayed');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      datePickerModal?.firstElementChild?.classList.add('in-position');
    });
  });
};

function hideDatePicker(): void {
  const datePickerModal: HTMLElement | null = document.querySelector('#date-picker-modal');
  datePickerModal?.firstElementChild?.classList.remove('in-position');

  setTimeout(() => { datePickerModal?.classList.remove('displayed') }, 100);
};