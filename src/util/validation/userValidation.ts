export function isValidEmail(email: string): boolean {
  const regex: RegExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
  return regex.test(email);
};

export function isValidName(name: string): boolean {
  const regex: RegExp = /^[A-Za-z ]{1,25}$/;
  return regex.test(name);
};

export function isValidPassword(password: string): boolean {
  const regex: RegExp = /^[A-Za-z0-9._]{8,40}$/;
  return regex.test(password);
};

export function isValidAuthTokenString(authToken: string): boolean {
  if (typeof authToken !== 'string') {
    return false;
  };

  if (authToken.length !== 32) {
    return false;
  };

  if (!authToken.startsWith('a') && !authToken.startsWith('g')) {
    return false;
  };

  return true;
};