import { hourMilliseconds, minuteMilliseconds } from "../global/clientConstants";
import { ConfirmModal } from "../global/ConfirmModal";

export function handleIrrecoverableError(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Something went wrong.',
    description: 'We ran into an unexpected error while fetching the data for you.',
    confirmBtnTitle: 'Reload page',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      window.location.reload();
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'home';
    };
  });
};

export function getDateAndTimeString(timestamp: number): string {
  const dateObj: Date = new Date(timestamp);

  const date: number = dateObj.getDate();
  const ordinalSuffix: string = getDateOrdinalSuffix(date);

  return `${getMonthName(dateObj)} ${date}${ordinalSuffix}, ${getTime(dateObj)}`;
};

export function getMonthName(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);
};

export function getDayName(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date);
};

export function getTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
};

export function getTotalTimeString(startTimestamp: number, endTimestamp: number): string {
  const differenceMilliseconds: number = endTimestamp - startTimestamp;

  const hours: number = Math.floor(differenceMilliseconds / hourMilliseconds);
  const minutes: number = Math.floor((differenceMilliseconds / minuteMilliseconds) % 60);

  const hoursString: string = hours === 1 ? '1 hour' : `${hours} hours`;
  let minutesString: string = '';

  if (minutes === 1) {
    minutesString = ', 1 minute';
  } else if (minutes > 1) {
    minutesString = `, ${minutes} minutes`;
  };

  const totalTimeString: string = hoursString + minutesString;
  return totalTimeString;
};

export function getDateOrdinalSuffix(date: number): string {
  if (date % 10 === 1) return 'st';
  if (date % 10 === 2) return 'nd';
  if (date % 10 === 3) return 'rd';

  return 'th';
}