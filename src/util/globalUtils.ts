export function getDateAndTimeString(timestamp: number): string {
  const date: Date = new Date(timestamp);
  return `${getMonthName(date)} ${date.getDate()}, ${date.getFullYear()} - ${getTime(date)}`;
};

function getMonthName(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);
};

function getTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' }).format(date);
};

export function containsInvalidWhitespace(string: string): boolean {
  if (string.trim() !== string) {
    return true;
  };

  const doubleWhitespacesRemoved: string = string.split(' ').filter((char: string) => char !== '').join(' ');
  if (string !== doubleWhitespacesRemoved) {
    return true;
  };

  return false;
};