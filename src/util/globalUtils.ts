export function getDateAndTimeString(timestamp: number): string {
  const dateObj: Date = new Date(timestamp);

  const date: number = dateObj.getDate();
  const ordinalSuffix: string = getOrdinalSuffix(date);

  return `${getMonthName(dateObj)} ${date}${ordinalSuffix}, ${getTime(dateObj)}`;
};

function getMonthName(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(date);
};

function getTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
};

function getOrdinalSuffix(date: number): string {
  if (date % 10 === 1 && date % 100 !== 11) return 'st';
  if (date % 10 === 2 && date % 100 !== 12) return 'nd';
  if (date % 10 === 3 && date % 100 !== 13) return 'rd';

  return 'th';
}

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