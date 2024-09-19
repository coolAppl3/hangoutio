import ErrorSpan from "./ErrorSpan";

export function isValidAuthToken(authToken: string): boolean {
  if (authToken.length < 34) {
    return false;
  };

  if (!authToken.startsWith('a') && !authToken.startsWith('g')) {
    return false;
  };

  if (authToken[32] !== '_') {
    return false;
  };

  if (!Number.isInteger(+authToken.substring(33))) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9_]{34,}$/;
  return regex.test(authToken);
};

export function validateEmail(input: HTMLInputElement): boolean {
  const email: string = input.value;

  if (email === '') {
    ErrorSpan.display(input, 'A valid email address is required.');
    return false;
  };

  if (email.trim() !== email) {
    ErrorSpan.display(input, 'Email address must not contain whitespace.');
    return false;
  };

  const regex: RegExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
  if (!regex.test(email)) {
    ErrorSpan.display(input, 'Invalid email address.');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

export function validateNewPassword(input: HTMLInputElement): boolean {
  const password: string = input.value;

  if (password === '') {
    ErrorSpan.display(input, 'A valid password is required.');
    return false;
  };

  if (password.trim() !== password) {
    ErrorSpan.display(input, 'Password must not contain whitespace.');
    return false;
  };

  if (password.length < 8) {
    ErrorSpan.display(input, 'Password must contain at least 8 characters.');
    return false;
  };

  if (password.length > 40) {
    ErrorSpan.display(input, `Password must not exceed 40 characters.`);
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9._]{8,40}$/;
  if (!regex.test(password)) {
    ErrorSpan.display(input, 'Only Latin alphanumerical characters, dots, and underscores are allowed.');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

export function validatePassword(input: HTMLInputElement): boolean {
  const password: string = input.value;

  if (password === '') {
    ErrorSpan.display(input, 'A valid password is required');
    return false;
  };

  if (password.trim() !== password) {
    ErrorSpan.display(input, 'Password must not contain whitespace.');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

export function validateNewUsername(input: HTMLInputElement): boolean {
  const username: string = input.value;

  if (username === '') {
    ErrorSpan.display(input, 'A valid username is required.');
    return false;
  };

  if (username.includes(' ')) {
    ErrorSpan.display(input, 'Username must not contain whitespace.');
    return false;
  };

  if (username.length < 5) {
    ErrorSpan.display(input, 'Username must contain at least 5 characters.');
    return false;
  };

  if (username.length > 25) {
    ErrorSpan.display(input, 'Username must not exceed 25 characters.');
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9_.]{5,25}$/;
  if (!regex.test(username)) {
    ErrorSpan.display(input, 'Only Latin alphanumerical characters, dots, and underscores are allowed.');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

export function validateUsername(input: HTMLInputElement): boolean {
  const username: string = input.value;

  if (username === '') {
    ErrorSpan.display(input, 'A valid username is required.');
    return false;
  };

  if (username.trim() !== username) {
    ErrorSpan.display(input, 'Username must not contain whitespace.');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

export function validateDisplayName(input: HTMLInputElement): boolean {
  const displayName: string = input.value;

  if (displayName === '') {
    ErrorSpan.display(input, 'A display name is required.');
    return false;
  };

  if (displayName.length > 25) {
    ErrorSpan.display(input, 'Display name must not exceed 25 characters.');
    return false;
  };

  if (displayName.trim() !== displayName) {
    ErrorSpan.display(input, 'Whitespace must not exist at either ends of the display name.');
    return false;
  };

  const doubleSpacesRemoved: string = displayName.split(' ').filter((char: string) => char !== '').join(' ');
  if (displayName !== doubleSpacesRemoved) {
    ErrorSpan.display(input, 'Only one space is allowed between words.');
    return false;
  };

  const regex: RegExp = /^[A-Za-z ]{1,25}$/;
  if (!regex.test(displayName)) {
    ErrorSpan.display(input, 'Only Latin letters and a single space between words are allowed.');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};