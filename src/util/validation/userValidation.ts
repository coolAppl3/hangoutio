import { containsInvalidWhitespace } from "../globalUtils";

export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') {
    return false;
  };

  const regex: RegExp = /^(?=.{6,254}$)[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]{0,64}@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}?(?:\.[a-zA-Z]{2,})*$/;
  return regex.test(email);
};


export function isValidNewPassword(password: string): boolean {
  if (typeof password !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9._]{8,40}$/;
  return regex.test(password);
};

export function isValidPassword(password: string): boolean {
  if (typeof password !== 'string') {
    return false;
  };

  if (password.trim() === '' || password.includes(' ')) {
    return false;
  };

  if (password.length > 40) {
    return false;
  };

  return true;
};

export function isValidUsername(username: string): boolean {
  if (typeof username !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9_.]{5,25}$/;
  return regex.test(username);
};

export function isValidDisplayName(displayName: string): boolean {
  if (typeof displayName !== 'string') {
    return false;
  };

  if (containsInvalidWhitespace(displayName)) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z ]{1,25}$/;
  return regex.test(displayName);
};

export function isValidRandomCode(verificationCode: string): boolean {
  if (typeof verificationCode !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-NP-Z0-9]{6}$/;
  return regex.test(verificationCode);
};