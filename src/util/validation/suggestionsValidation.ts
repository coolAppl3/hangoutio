export const suggestionsLimit: number = 10;

export function isValidSuggestionTitle(title: string): boolean {
  if (typeof title !== 'string') {
    return false;
  };

  if (title.trim() !== title) {
    return false;
  };

  const doubleSpacesRemoved: string = title.split(' ').filter((char: string) => char !== '').join(' ');
  if (title !== doubleSpacesRemoved) {
    return false;
  };

  const titleRegex: RegExp = /^[-A-Za-z0-9 ()!?.]{3,40}$/;
  return titleRegex.test(title);
};

export function isValidSuggestionDescription(description: string): boolean {
  if (typeof description !== 'string') {
    return false;
  };

  description = description.trim();

  const descriptionRegex: RegExp = /^[ -~\u20AC\r\n]{10,500}$/; // printable ASCII, euro symbol, and line breaks. 
  return descriptionRegex.test(description);
};