export function isValidMessageContent(message: string): boolean {
  if (typeof message !== 'string') {
    return false;
  };

  if (message !== message.trim()) {
    return false;
  };

  const messageRegex: RegExp = /^[ -~\r\n]{1,2000}$/;
  return messageRegex.test(message);
};