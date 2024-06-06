import { hangoutFormState } from "./hangoutFormState";

import revealPassword from "../global/revealPassword";
import ErrorSpan from "../global/ErrorSpan";

export default function hangoutAccount(): void {
  loadEventListeners();
};


function loadEventListeners(): void {
  const accountPasswordIcon: HTMLDivElement | null = document.querySelector('#password-icon-account');
  accountPasswordIcon?.addEventListener('click', () => { revealPassword(accountPasswordIcon) });

  const stepsForm: HTMLFormElement | null = document.querySelector('#steps-form');
  stepsForm?.addEventListener('submit', setAccountDetails);
};

function setAccountDetails(e: SubmitEvent): void {
  e.preventDefault();

  const accountNameInput: HTMLInputElement | null = document.querySelector('#account-name');
  const accountPasswordInput: HTMLInputElement | null = document.querySelector('#account-password');

  if (!accountNameInput || !accountPasswordInput) {
    return;
  };

  const isValidName: boolean = validateAccountName(accountNameInput);
  const isValidPassword: boolean = validatePassword(accountPasswordInput);

  if (!isValidName || !isValidPassword) {
    return;
  };

  hangoutFormState.leaderName = accountNameInput.value.toLowerCase();
  hangoutFormState.leaderPassword = accountPasswordInput.value;

  dispatchAccountEvent();
};

function dispatchAccountEvent(): void {
  const accountDetailsValidEvent: CustomEvent = new CustomEvent<undefined>('accountDetailsValid');
  window.dispatchEvent(accountDetailsValidEvent);
};

function validateAccountName(accountInput: HTMLInputElement): boolean {
  if (accountInput.value.trim() === '') {
    ErrorSpan.display(accountInput, 'Name must at least contain one letter.');
    return false;
  };

  if (accountInput.value.trim().length > 25) {
    ErrorSpan.display(accountInput, 'Name must not be longer than 25 letters.');
    return false;
  };

  const regex: RegExp = /^[A-Za-z\s]{1,25}$/;
  if (!regex.test(accountInput.value)) {
    ErrorSpan.display(accountInput, 'Name must only contain English letters.');
    return false;
  };

  ErrorSpan.hide(accountInput);
  return true;
};

function validatePassword(accountPasswordInput: HTMLInputElement): boolean {
  if (accountPasswordInput.value.length < 8) {
    ErrorSpan.display(accountPasswordInput, 'Password must not be shorter than 8 characters.');
    return false;
  };

  if (accountPasswordInput.value.length > 40) {
    ErrorSpan.display(accountPasswordInput, 'Password must not be longer than 40 characters.');
    return false;
  };

  if (accountPasswordInput.value.includes(' ')) {
    ErrorSpan.display(accountPasswordInput, 'Password must not contain any whitespace.');
    return false;
  };

  const regex = /^[A-Za-z0-9._]{8,40}$/;
  if (!regex.test(accountPasswordInput.value)) {
    ErrorSpan.display(accountPasswordInput, 'Special characters, apart from dots and underscores, are not allowed.');
    return false;
  };

  ErrorSpan.hide(accountPasswordInput);
  return true;
};