import '../scss/main.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { validateEmail, validatePassword, validateUsername } from './modules/global/validation';

topNavbar();
botNavbar();

interface SignInFormState {
  isGuestUser: boolean,
  keepSignedIn: boolean,

  accountEmail: string | null,
  accountPassword: string | null,

  guestUsername: string | null,
  guestPassword: string | null,
};

const signInFormState: SignInFormState = {
  isGuestUser: false,
  keepSignedIn: false,

  accountEmail: null,
  accountPassword: null,

  guestUsername: null,
  guestPassword: null,
};

const signInForm: HTMLFormElement | null = document.querySelector('#sign-in-form');
const signInFormContainer: HTMLDivElement | null = document.querySelector('#sign-in-form-container');

const signInOptions: HTMLDivElement | null = document.querySelector('#sign-in-options');
const accountOptionBtn: HTMLButtonElement | null = document.querySelector('#account-option-btn');
const guestOptionBtn: HTMLButtonElement | null = document.querySelector('#guest-option-btn');

const accountForm: HTMLDivElement | null = document.querySelector('#account-form');
const accountEmailInput: HTMLInputElement | null = document.querySelector('#account-email-input');
const accountPasswordInput: HTMLInputElement | null = document.querySelector('#account-password-input');
const accountPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#account-password-input-reveal-btn');

const guestForm: HTMLDivElement | null = document.querySelector('#guest-form');
const guestUsernameInput: HTMLInputElement | null = document.querySelector('#guest-username-input');
const guestPasswordInput: HTMLInputElement | null = document.querySelector('#guest-password-input');
const guestPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#guest-password-input-reveal-btn');

((): void => {
  loadEventListeners();
  setActiveValidation();
})();

function loadEventListeners(): void {
  signInForm?.addEventListener('submit', submitForm);

  signInOptions?.addEventListener('click', updateSignInOption);
};

function submitForm(e: SubmitEvent): void {
  e.preventDefault();

};

function updateSignInOption(e: MouseEvent): void {
  e.preventDefault();

  if (!(e.target instanceof HTMLElement)) {
    return;
  };

  if (e.target.id === accountOptionBtn?.id) {
    switchToAccountForm();
    return;
  };

  if (e.target.id === guestOptionBtn?.id) {
    switchToGuestForm();
  };
};

function switchToAccountForm(): void {
  accountForm ? accountForm.style.display = 'block' : undefined;
  guestForm ? guestForm.style.display = 'none' : undefined;

  guestOptionBtn?.classList.remove('selected');
  accountOptionBtn?.classList.add('selected');

  signInOptions?.classList.remove('guest');
  clearGuestForm();
};

function switchToGuestForm(): void {
  guestForm ? guestForm.style.display = 'block' : undefined;
  accountForm ? accountForm.style.display = 'none' : undefined;

  accountOptionBtn?.classList.remove('selected');
  guestOptionBtn?.classList.add('selected');

  signInOptions?.classList.add('guest');
  clearAccountForm
};

function clearGuestForm(): void {
  guestUsernameInput ? guestUsernameInput.value = '' : undefined;
  guestPasswordInput ? guestPasswordInput.value = '' : undefined;
};

function clearAccountForm(): void {
  accountEmailInput ? accountEmailInput.value = '' : undefined;
  accountPasswordInput ? accountPasswordInput.value = '' : undefined;
};

function setActiveValidation(): void {
  accountEmailInput?.addEventListener('input', () => { validateEmail(accountEmailInput) });
  accountPasswordInput?.addEventListener('input', () => { validatePassword(accountPasswordInput) });

  guestUsernameInput?.addEventListener('input', () => { validateUsername(guestUsernameInput) });
  guestPasswordInput?.addEventListener('input', () => { validatePassword(guestPasswordInput) });
};