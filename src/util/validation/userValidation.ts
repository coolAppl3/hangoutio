export function isValidEmailString(email: string): boolean {
  if (typeof email !== 'string') {
    return false;
  };

  const regex: RegExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
  return regex.test(email);
};

export function isValidNewPasswordString(password: string): boolean {
  if (typeof password !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9._]{8,40}$/;
  return regex.test(password);
};

export function isValidPasswordString(password: string): boolean {
  if (typeof password !== 'string' || password.trim() === '') {
    return false;
  };

  return true;
};

export function isValidUsernameString(username: string): boolean {
  if (typeof username !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9_.]{5,25}$/;
  return regex.test(username);
};

export function isValidDisplayNameString(displayName: string): boolean {
  if (typeof displayName !== 'string') {
    return false;
  };

  if (displayName.trim() !== displayName) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z ]{1,25}$/;
  return regex.test(displayName);
};

export function isValidAuthTokenString(authToken: string): boolean {
  if (typeof authToken !== 'string') {
    return false;
  };

  if (authToken.length < 34) {
    return false;
  };

  if (authToken[32] !== '_') {
    return false;
  };

  if (!Number.isInteger(+authToken.substring(33))) {
    return false;
  };

  if (!authToken.startsWith('a') && !authToken.startsWith('g')) {
    return false;
  };

  return true;
};

export function getUserID(authToken: string): number {
  return +authToken.substring(33);
};

export function getUserType(authToken: string): 'account' | 'guest' {
  if (authToken.startsWith('a')) {
    return 'account';
  };

  return 'guest';
};

export function isValidToken(token: string): boolean {
  if (typeof token !== 'string') {
    return false;
  };

  if (token.length !== 32) {
    return false;
  };

  return true;
};

export function isValidCodeString(verificationCode: string): boolean {
  if (typeof verificationCode !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-NP-Z0-9]{6}$/;
  return regex.test(verificationCode);
};