const titleRegex: RegExp = /^[a-zA-Z0-9]{1,50}$/;
const descriptionRegex: RegExp = /^.{0,500}$/s;

export function isValidSuggestionTitle(title: string): boolean {
  if (typeof title !== 'string') {
    return false;
  };

  return titleRegex.test(title);
};

export function isValidSuggestionDescription(description: string): boolean {
  if (typeof description !== 'string') {
    return false;
  };

  return descriptionRegex.test(description);
};