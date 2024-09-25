import { isValidHangoutID, validateEmail, validatePassword, validateUsername } from '../global/validation';
import revealPassword from '../global/revealPassword';
import ErrorSpan from '../global/ErrorSpan';
import Cookies from '../global/Cookies';
import { getAuthToken } from '../global/getAuthToken';
import LoadingModal from '../global/LoadingModal';
import popup from '../global/popup';
import { AccountSignInBody, AccountSignInData, accountSignInService } from '../services/accountServices';
import axios, { AxiosError } from '../../../../node_modules/axios/index';
import { GuestSignInBody, GuestSignInData, guestSignInService } from '../services/guestServices';
import { signOut } from '../global/signOut';

interface SignInFormState {
  isGuestUser: boolean,
  keepSignedIn: boolean,
};

const signInFormState: SignInFormState = {
  isGuestUser: false,
  keepSignedIn: false,
};

const signInFormElement: HTMLFormElement | null = document.querySelector('#sign-in-form');

const signInOptions: HTMLDivElement | null = document.querySelector('#sign-in-options');
const accountOptionBtn: HTMLButtonElement | null = document.querySelector('#account-option-btn');
const guestOptionBtn: HTMLButtonElement | null = document.querySelector('#guest-option-btn');
const keepSignedInBtn: HTMLButtonElement | null = document.querySelector('#keep-signed-in-btn');

const accountForm: HTMLDivElement | null = document.querySelector('#account-form');
const accountEmailInput: HTMLInputElement | null = document.querySelector('#account-email-input');
const accountPasswordInput: HTMLInputElement | null = document.querySelector('#account-password-input');
const accountPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#account-password-input-reveal-btn');

const guestForm: HTMLDivElement | null = document.querySelector('#guest-form');
const guestUsernameInput: HTMLInputElement | null = document.querySelector('#guest-username-input');
const guestPasswordInput: HTMLInputElement | null = document.querySelector('#guest-password-input');
const guestPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#guest-password-input-reveal-btn');

export function signInForm(): void {
  init();
  loadEventListeners();
};

function init(): void {
  setActiveValidation();
  detectSignedInUser();
};

function loadEventListeners(): void {
  signInFormElement?.addEventListener('submit', submitForm);
  signInOptions?.addEventListener('click', updateSignInOption);
  keepSignedInBtn?.addEventListener('click', updateSignedInDurationPreferences);

  accountPasswordRevealBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    revealPassword(accountPasswordRevealBtn);
  });

  guestPasswordRevealBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    revealPassword(guestPasswordRevealBtn);
  });
};

async function submitForm(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (signInFormState.isGuestUser) {
    await guestSignIn();
    return;
  };

  await accountSignIn();
};

async function accountSignIn(): Promise<void> {
  if (!isValidAccountDetails()) {
    popup('Invalid account sign in details.', 'error');
    LoadingModal.hide();

    return;
  };

  if (!accountEmailInput || !accountPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.hide();

    return;
  };

  const accountSignInBody: AccountSignInBody = {
    email: accountEmailInput.value,
    password: accountPasswordInput.value,
  };

  try {
    const accountSignInData: AccountSignInData = await accountSignInService(accountSignInBody);
    const { authToken } = accountSignInData.data.resData;

    if (signInFormState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, 14 * daySeconds);

    } else {
      Cookies.set('authToken', authToken);
    };

    popup('Signed in successfully.', 'success');
    setTimeout(() => window.location.href = `account.html`, 1000);

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      LoadingModal.hide();

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      LoadingModal.hide();

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    popup(errMessage, 'error');
    LoadingModal.hide();

    if (status === 400 && errReason === 'email') {
      ErrorSpan.display(accountEmailInput, errMessage);
      return;
    };

    if (status === 400 && errReason === 'password') {
      ErrorSpan.display(accountPasswordInput, errMessage);
      return;
    };

    if ((status === 404 || status === 403)) {
      ErrorSpan.display(accountEmailInput, errMessage);
      return;
    };

    if (status === 401) {
      ErrorSpan.display(accountPasswordInput, errMessage);
      return;
    };
  };
};

async function guestSignIn(): Promise<void> {
  if (!isValidGuestDetails()) {
    popup('Invalid guest sign in details.', 'error');
    LoadingModal.hide();

    return;
  };

  if (!guestUsernameInput || !guestPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.hide();

    return;
  };

  const guestSignInBody: GuestSignInBody = {
    username: guestUsernameInput.value,
    password: guestPasswordInput.value,
  };

  try {
    const guestSignInData: GuestSignInData = await guestSignInService(guestSignInBody);
    const { authToken, hangoutID } = guestSignInData.data.resData;

    if (signInFormState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;

      Cookies.set('authToken', authToken, 14 * daySeconds);
      Cookies.set('guestHangoutID', hangoutID, 14 * daySeconds);

    } else {
      Cookies.set('authToken', authToken);
      Cookies.set('guestHangoutID', hangoutID);
    };

    popup('Signed in successfully.', 'success');
    setTimeout(() => window.location.href = `hangout.html?id=${hangoutID}`, 1000);

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      LoadingModal.hide();

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      LoadingModal.hide();

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    popup(errMessage, 'error');
    LoadingModal.hide();

    if (status === 400 && errReason === 'username') {
      ErrorSpan.display(guestUsernameInput, errMessage);
      return;
    };

    if (status === 400 && errReason === 'password') {
      ErrorSpan.display(guestPasswordInput, errMessage);
      return;
    };

    if (status === 401) {
      ErrorSpan.display(guestPasswordInput, errMessage);
      return;
    };
  };
};

function isValidAccountDetails(): boolean {
  if (!accountEmailInput || !accountPasswordInput) {
    return false;
  };

  const isValidAccountEmail: boolean = validateEmail(accountEmailInput);
  const isValidAccountPassword: boolean = validatePassword(accountPasswordInput);

  if (!isValidAccountEmail || !isValidAccountPassword) {
    return false;
  };

  return true;
};

function isValidGuestDetails(): boolean {
  if (!guestUsernameInput || !guestPasswordInput) {
    return false;
  };

  const isValidGuestUsername: boolean = validateUsername(guestUsernameInput);
  const isValidGuestPassword: boolean = validatePassword(guestPasswordInput);

  if (!isValidGuestUsername || !isValidGuestPassword) {
    return false;
  };

  return true;
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
  signInFormState.isGuestUser = false;

  accountForm ? accountForm.style.display = 'block' : undefined;
  guestForm ? guestForm.style.display = 'none' : undefined;

  guestOptionBtn?.classList.remove('selected');
  accountOptionBtn?.classList.add('selected');

  signInOptions?.classList.remove('guest');
  clearGuestForm();
};

function switchToGuestForm(): void {
  signInFormState.isGuestUser = true;

  guestForm ? guestForm.style.display = 'block' : undefined;
  accountForm ? accountForm.style.display = 'none' : undefined;

  accountOptionBtn?.classList.remove('selected');
  guestOptionBtn?.classList.add('selected');

  signInOptions?.classList.add('guest');
  clearAccountForm();
};

function clearGuestForm(): void {
  if (guestUsernameInput) {
    guestUsernameInput.value = '';
    ErrorSpan.hide(guestUsernameInput);
  };

  if (guestPasswordInput) {
    guestPasswordInput.value = '';
    ErrorSpan.hide(guestPasswordInput);
  };
};

function clearAccountForm(): void {
  if (accountEmailInput) {
    accountEmailInput.value = '';
    ErrorSpan.hide(accountEmailInput);
  };

  if (accountPasswordInput) {
    accountPasswordInput.value = '';
    ErrorSpan.hide(accountPasswordInput);
  };
};

function setActiveValidation(): void {
  accountEmailInput?.addEventListener('input', () => { validateEmail(accountEmailInput) });
  accountPasswordInput?.addEventListener('input', () => { validatePassword(accountPasswordInput) });

  guestUsernameInput?.addEventListener('input', () => { validateUsername(guestUsernameInput) });
  guestPasswordInput?.addEventListener('input', () => { validatePassword(guestPasswordInput) });
};

function detectSignedInUser(): void {
  const authToken: string | null = getAuthToken();

  if (!authToken) {
    return;
  };

  if (authToken.startsWith('g')) {
    const guestHangoutID: string | null = Cookies.get('guestHangoutID');

    if (!guestHangoutID || !isValidHangoutID(guestHangoutID)) {
      signOut();
      window.location.reload();

      return;
    };

    window.location.href = `hangout.html?id=${guestHangoutID}`;
    return;
  };

  window.location.href = 'account.html';
};

function updateSignedInDurationPreferences(e: MouseEvent): void {
  e.preventDefault();
  signInFormState.keepSignedIn = !signInFormState.keepSignedIn;

  if (keepSignedInBtn?.classList.contains('checked')) {
    keepSignedInBtn.classList.remove('checked');
    return;
  };

  keepSignedInBtn?.classList.add('checked');
};