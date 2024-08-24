export function getDateAndTimeSTring(timestamp: number): string {
  const date: Date = new Date(timestamp);
  return `${getMonthName(date)} ${date.getDate()}, ${date.getFullYear()} - ${getTime(date)}`;
};

function getMonthName(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);
};

function getTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' }).format(date);
};