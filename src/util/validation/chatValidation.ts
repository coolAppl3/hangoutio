export function isValidMessageContent(message: string): boolean {
  if (typeof message !== 'string') {
    return false;
  };

  if (message !== message.trim()) {
    return false;
  };

  const messageRegex: RegExp = /^[ -~\u20AC\r\n]{10,500}$/; // printable ASCII, euro symbol, and line breaks. 
  return messageRegex.test(message);
};