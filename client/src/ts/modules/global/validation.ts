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

  if (email.includes(' ')) {
    ErrorSpan.display(input, 'Email address must not contain whitespace.');
    return false;
  };

  const regex: RegExp = /^(?=.{6,254}$)[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]{0,64}@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}?(?:\.[a-zA-Z]{2,})*$/;
  if (!regex.test(email)) {
    ErrorSpan.display(input, 'Invalid email address.');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

export function validateHangoutTitle(input: HTMLInputElement): boolean {
  const title: string = input.value;

  if (title === '') {
    ErrorSpan.display(input, 'A valid hangout title is required.');
    return false;
  };

  if (title.length < 3) {
    ErrorSpan.display(input, 'Title must contain at least 3 characters.');
    return false;
  };

  if (title.length > 25) {
    ErrorSpan.display(input, 'Title must not exceed 25 characters.');
    return false;
  };

  if (title.trim() !== title) {
    ErrorSpan.display(input, 'Whitespace must not exist at either ends of the title.');
    return false;
  };

  const doubleSpacesRemoved: string = title.split(' ').filter((char: string) => char !== '').join(' ');
  if (title !== doubleSpacesRemoved) {
    ErrorSpan.display(input, 'Only one whitespace is allowed between words.');
    return false;
  };

  const regex: RegExp = /^[A-Za-z ]{3,25}$/;
  if (!regex.test(title)) {
    ErrorSpan.display(input, 'Only English letters and a single space between words are allowed.');
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

  if (password.includes(' ')) {
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
    ErrorSpan.display(input, 'Only English alphanumerical characters, dots, and underscores are allowed.');
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

  if (password.includes(' ')) {
    ErrorSpan.display(input, 'Password must not contain whitespace.');
    return false;
  };

  if (password.length > 40) {
    ErrorSpan.display(input, 'Password can not be longer than 40 characters.');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

export function validateConfirmPassword(confirmInput: HTMLInputElement, referenceInput: HTMLInputElement): boolean {
  if (confirmInput.value.trim() === '') {
    ErrorSpan.display(confirmInput, 'Password confirmation is required.');
    return false;
  };

  if (confirmInput.value !== referenceInput.value) {
    ErrorSpan.display(confirmInput, `Passwords don't match.`);
    return false;
  };

  ErrorSpan.hide(confirmInput);
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
    ErrorSpan.display(input, 'Only English alphanumerical characters, dots, and underscores are allowed.');
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

  if (username.includes(' ')) {
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
    ErrorSpan.display(input, 'Only one whitespace is allowed between words.');
    return false;
  };

  const regex: RegExp = /^[A-Za-z ]{1,25}$/;
  if (!regex.test(displayName)) {
    ErrorSpan.display(input, 'Only English letters and a single space between words are allowed.');
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

export function validateCode(input: HTMLInputElement): boolean {
  const code: string = input.value.toUpperCase();

  if (code.includes('O')) {
    ErrorSpan.display(input, `Code can not contain the letter "O". Replace it with the number 0.`);
    return false;
  };

  if (code.includes(' ')) {
    ErrorSpan.display(input, 'Code must not contain whitespace.');
    return false;
  };

  if (code.length !== 6) {
    ErrorSpan.display(input, 'Code must be 6 characters long.');
    return false;
  };

  const regex: RegExp = /^[A-NP-Z0-9]{6}$/;
  if (!regex.test(code)) {
    ErrorSpan.display(input, `Only uppercase English letters and numbers are allowed, apart from the letter "O".`);
    return false;
  };

  ErrorSpan.hide(input);
  return true;
};

export function isValidCode(verificationCode: string): boolean {
  const regex: RegExp = /^[A-NP-Z0-9]{6}$/;
  return regex.test(verificationCode.toUpperCase());
};

export function isValidHangoutID(hangoutID: string): boolean {
  if (hangoutID.length !== 46) {
    return false;
  };

  if (!hangoutID.startsWith('h')) {
    return false;
  };

  if (hangoutID[32] !== '_') {
    return false;
  };

  if (hangoutID.substring(33).length !== 13 || !isValidTimestamp(+hangoutID.substring(33))) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9_]{46,}$/;
  return regex.test(hangoutID);
};

export function isValidTimestamp(timestamp: number): boolean {
  const timeStampLength: number = 13;

  if (!Number.isInteger(timestamp)) {
    return false;
  };

  if (timestamp.toString().length !== timeStampLength) {
    return false;
  };

  if (timestamp < 0) {
    return false;
  };

  return true;
};

export function isValidUniqueToken(token: string): boolean {
  if (typeof token !== 'string') {
    return false;
  };

  if (token.length !== 32) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9]{32}$/;
  return regex.test(token);
};

export function isValidQueryString(queryString: string): boolean {
  if (queryString === '') {
    return false;
  };

  const regex: RegExp = /^\?[A-Za-z0-9][A-Za-z0-9&=]{0,150}$/;
  return regex.test(queryString);
};