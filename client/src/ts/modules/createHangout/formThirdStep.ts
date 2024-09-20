import axios, { AxiosError } from "../../../../node_modules/axios/index";
import Cookies from "../global/Cookies";
import ErrorSpan from "../global/ErrorSpan";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import revealPassword from "../global/revealPassword";
import { isValidAuthToken, validateDisplayName, validateEmail, validateNewPassword, validateNewUsername, validatePassword } from "../global/validation";
import { AccountSignInBody, AccountSignInData, accountSignInService } from "../services/accountServices";
import { AccountLeaderHangoutBody, AccountLeaderHangoutData, createAccountLeaderHangoutService, createGuestLeaderHangoutService, GuestLeaderHangoutBody, GuestLeaderHangoutData } from "../services/hangoutServices";
import { formState } from "./formState";

interface ThirdStepState {
  isSignedIn: boolean,
  isGuestUser: boolean,
  keepSignedIn: boolean,

  accountEmail: string | null,
  accountPassword: string | null,

  guestUsername: string | null,
  guestPassword: string | null,
  guestDisplayName: string | null,
};

const thirdStepState: ThirdStepState = {
  isSignedIn: false,
  isGuestUser: false,
  keepSignedIn: false,

  accountEmail: null,
  accountPassword: null,

  guestUsername: null,
  guestPassword: null,
  guestDisplayName: null,
};

const accountPreferences: HTMLDivElement | null = document.querySelector('#account-preferences');
const accountOptionBtn: HTMLButtonElement | null = document.querySelector('#account-option-btn');
const guestOptionBtn: HTMLButtonElement | null = document.querySelector('#guest-option-btn');
const accountForm: HTMLDivElement | null = document.querySelector('#account-form');
const guestForm: HTMLDivElement | null = document.querySelector('#guest-form');

const hangoutForm: HTMLFormElement | null = document.querySelector('#hangout-form');
const accountEmailInput: HTMLInputElement | null = document.querySelector('#account-email-input');
const accountPasswordInput: HTMLInputElement | null = document.querySelector('#account-password-input');
const guestUsernameInput: HTMLInputElement | null = document.querySelector('#guest-username-input');
const guestPasswordInput: HTMLInputElement | null = document.querySelector('#guest-password-input');
const guestDisplayNameInput: HTMLInputElement | null = document.querySelector('#guest-display-name-input');

const accountPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#account-password-input-reveal-btn');
const guestPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#guest-password-input-reveal-btn');
const keepSignedInBtn: HTMLButtonElement | null = document.querySelector('#keep-signed-in');

export function formThirdStep(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('DOMContentLoaded', init);
  accountPreferences?.addEventListener('click', updateAccountPreferences);
  keepSignedInBtn?.addEventListener('click', updateSignInDurationPreferences);
  hangoutForm?.addEventListener('submit', submitHangout);

  accountPasswordRevealBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    revealPassword(accountPasswordRevealBtn);
  });

  guestPasswordRevealBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    revealPassword(guestPasswordRevealBtn);
  });
};

function init(): void {
  setActiveInputValidation();
  detectAuthToken();
};

async function submitHangout(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (thirdStepState.isGuestUser) {
    await createGuestLeaderHangout();
    return;
  };

  if (thirdStepState.isSignedIn) {
    await createSignedInAccountLeaderHangout();
    return;
  };

  await createAccountLeaderHangout();
};

async function createAccountLeaderHangout(attemptCount: number = 1): Promise<void> {
  if (attemptCount > 2) {
    popup('Internal server error.', 'error');
    LoadingModal.hide();

    return;
  };

  if (!isValidAccountDetails()) {
    popup('Invalid account details.', 'error');
    LoadingModal.hide();

    return;
  };

  if (!accountEmailInput || !accountPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.hide();

    return;
  };

  thirdStepState.accountEmail = accountEmailInput.value;
  thirdStepState.accountPassword = accountPasswordInput.value;

  const accountSignInBody: AccountSignInBody = {
    email: thirdStepState.accountEmail,
    password: thirdStepState.accountPassword,
  };

  try {
    const accountSignInData: AccountSignInData = await accountSignInService(accountSignInBody);
    const { authToken } = accountSignInData.data.resData;

    if (thirdStepState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, 14 * daySeconds);

    } else {
      Cookies.set('authToken', authToken);
    };

    const dayMilliseconds: number = 1000 * 60 * 60 * 24;

    const accountLeaderHangoutBody: AccountLeaderHangoutBody = {
      hangoutPassword: formState.hangoutPassword,
      memberLimit: formState.memberLimit,
      availabilityStep: formState.availabilityStep * dayMilliseconds,
      suggestionsStep: formState.suggestionsStep * dayMilliseconds,
      votingStep: formState.votingStep * dayMilliseconds,
    };

    const accountLeaderHangoutData: AccountLeaderHangoutData = await createAccountLeaderHangoutService(authToken, accountLeaderHangoutBody);
    const { hangoutID } = accountLeaderHangoutData.data.resData;

    popup('Hangout created.', 'success', 1000);
    setTimeout(() => window.location.href = `/hangouts.html?id=${hangoutID}`, 1000);

  } catch (err: unknown) {
    console.log(err)

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      LoadingModal.hide();

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.response || !axiosError.status) {
      popup('Something went wrong.', 'error');
      LoadingModal.hide();

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;
    const endpoint: string | undefined = axiosError.response.config.url?.split('api/')[1];

    if (status === 409 && errReason === 'duplicateHangoutID') {
      await createAccountLeaderHangout(++attemptCount);
      return;
    };

    popup(errMessage, 'error');
    LoadingModal.hide();

    if (endpoint?.startsWith('accounts')) {
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
};

async function createSignedInAccountLeaderHangout(attemptCount: number = 1): Promise<void> {
  if (attemptCount > 2) {
    popup('Internal server error.', 'error');
    LoadingModal.hide();

    return;
  };

  const authToken: string | null = Cookies.get('authToken');

  if (!authToken) {
    popup('Not signed in.', 'error');
    return;
  };

  const dayMilliseconds: number = 1000 * 60 * 60 * 24;

  const accountLeaderHangoutBody: AccountLeaderHangoutBody = {
    hangoutPassword: formState.hangoutPassword,
    memberLimit: formState.memberLimit,
    availabilityStep: formState.availabilityStep * dayMilliseconds,
    suggestionsStep: formState.suggestionsStep * dayMilliseconds,
    votingStep: formState.votingStep * dayMilliseconds,
  };

  try {
    const accountLeaderHangoutData: AccountLeaderHangoutData = await createAccountLeaderHangoutService(authToken, accountLeaderHangoutBody);
    const { hangoutID } = accountLeaderHangoutData.data.resData;

    popup('Hangout created.', 'success', 1000);
    setTimeout(() => window.location.href = `/hangouts.html?id=${hangoutID}`, 1000);

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      LoadingModal.hide();

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.response || !axiosError.status) {
      popup('Something went wrong.', 'error');
      LoadingModal.hide();

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 409 && errReason === 'duplicateHangoutID') {
      await createSignedInAccountLeaderHangout(++attemptCount);
      return;
    };

    popup(errMessage, 'error');
    LoadingModal.hide();

    if (status === 401) {
      thirdStepState.isSignedIn = false;
      Cookies.remove('authToken');

      const thirdStepFormContainer: HTMLDivElement | null = document.querySelector('#hangout-form-step-3-container');
      thirdStepFormContainer?.classList.remove('disabled');
    };
  };
};

async function createGuestLeaderHangout(attemptCount: number = 1): Promise<void> {
  if (attemptCount > 2) {
    popup('Internal server error.', 'error');
    LoadingModal.hide();

    return;
  };

  if (!isValidGuestDetails()) {
    popup('Invalid guest details.', 'error');
    LoadingModal.hide();

    return;
  };

  if (!guestUsernameInput || !guestPasswordInput || !guestDisplayNameInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.hide();

    return;
  };

  thirdStepState.guestUsername = guestUsernameInput.value;
  thirdStepState.guestPassword = guestPasswordInput.value;
  thirdStepState.guestDisplayName = guestDisplayNameInput.value;

  const dayMilliseconds: number = 1000 * 60 * 60 * 24;

  const guestLeaderHangoutBody: GuestLeaderHangoutBody = {
    hangoutPassword: formState.hangoutPassword,
    memberLimit: formState.memberLimit,
    availabilityStep: formState.availabilityStep * dayMilliseconds,
    suggestionsStep: formState.suggestionsStep * dayMilliseconds,
    votingStep: formState.votingStep * dayMilliseconds,
    username: thirdStepState.guestUsername,
    password: thirdStepState.guestPassword,
    displayName: thirdStepState.guestDisplayName,
  };

  try {
    const guestLeaderHangoutData: GuestLeaderHangoutData = await createGuestLeaderHangoutService(guestLeaderHangoutBody);
    const { hangoutID, authToken } = guestLeaderHangoutData.data.resData;

    if (thirdStepState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, daySeconds);

    } else {
      Cookies.set('authToken', authToken);
    };

    popup('Hangout created.', 'success', 1000);
    setTimeout(() => window.location.href = `/hangouts.html?id=${hangoutID}`, 1000);

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      LoadingModal.hide();

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.response || !axiosError.status) {
      popup('Something went wrong.', 'error');
      LoadingModal.hide();

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 409 && errReason === 'duplicateHangoutID') {
      await createGuestLeaderHangout(++attemptCount);
      return;
    };

    popup(errMessage, 'error');
    LoadingModal.hide();

    if (status === 400 && errReason === 'username') {
      ErrorSpan.display(guestUsernameInput, errMessage);
      return;
    };

    if (status === 400 && errReason === 'guestPassword') {
      ErrorSpan.display(guestPasswordInput, errMessage);
      return;
    };

    if (status === 400 && errReason === 'guestDisplayName') {
      ErrorSpan.display(guestDisplayNameInput, errMessage);
      return;
    };

    if (status === 409 && errReason === 'guestUsernameTaken') {
      ErrorSpan.display(guestUsernameInput, errMessage);
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
  if (!guestUsernameInput || !guestPasswordInput || !guestDisplayNameInput) {
    return false;
  };

  const isValidGuestUsername: boolean = validateNewUsername(guestUsernameInput);
  const isValidGuestPassword: boolean = validateNewPassword(guestPasswordInput);
  const isValidGuestDisplayName: boolean = validateDisplayName(guestDisplayNameInput);

  if (!isValidGuestUsername || !isValidGuestPassword || !isValidGuestDisplayName) {
    return false;
  };

  return true;
};

// navigation
function updateAccountPreferences(e: MouseEvent): void {
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
  if (accountOptionBtn?.classList.contains('selected')) {
    return;
  };

  thirdStepState.isGuestUser = false;

  guestForm ? guestForm.style.display = 'none' : undefined;
  accountForm ? accountForm.style.display = 'block' : undefined;

  guestOptionBtn?.classList.remove('selected');
  accountOptionBtn?.classList.add('selected');

  accountPreferences?.classList.remove('guest');
  clearGuestForm();
};

function switchToGuestForm(): void {
  if (guestOptionBtn?.classList.contains('selected')) {
    return;
  };

  thirdStepState.isGuestUser = true;

  accountForm ? accountForm.style.display = 'none' : undefined;
  guestForm ? guestForm.style.display = 'block' : undefined;

  accountOptionBtn?.classList.remove('selected');
  guestOptionBtn?.classList.add('selected');

  accountPreferences?.classList.add('guest');
  clearAccountForm();
};

function clearAccountForm(): void {
  if (accountEmailInput) {
    ErrorSpan.hide(accountEmailInput);
    accountEmailInput.value = '';
    thirdStepState.accountEmail = null;
  };

  if (accountPasswordInput) {
    ErrorSpan.hide(accountPasswordInput);
    accountPasswordInput.value = '';
    thirdStepState.accountPassword = null;
  };
};

function clearGuestForm(): void {
  if (guestUsernameInput) {
    ErrorSpan.hide(guestUsernameInput);
    guestUsernameInput.value = '';
    thirdStepState.guestUsername = null;
  };

  if (guestPasswordInput) {
    ErrorSpan.hide(guestPasswordInput);
    guestPasswordInput.value = '';
    thirdStepState.guestPassword = null;
  };

  if (guestDisplayNameInput) {
    ErrorSpan.hide(guestDisplayNameInput);
    guestDisplayNameInput.value = '';
    thirdStepState.guestDisplayName = null;
  };
};

function updateSignInDurationPreferences(e: MouseEvent): void {
  e.preventDefault();
  thirdStepState.keepSignedIn = !thirdStepState.keepSignedIn

  if (keepSignedInBtn?.classList.contains('checked')) {
    keepSignedInBtn?.classList.remove('checked');
    return;
  };

  keepSignedInBtn?.classList.add('checked');
};

function setActiveInputValidation(): void {
  accountEmailInput?.addEventListener('input', () => { validateEmail(accountEmailInput) });
  accountPasswordInput?.addEventListener('input', () => { validatePassword(accountPasswordInput) });
  guestUsernameInput?.addEventListener('input', () => { validateNewUsername(guestUsernameInput) });
  guestPasswordInput?.addEventListener('input', () => { validateNewPassword(guestPasswordInput) });
  guestDisplayNameInput?.addEventListener('input', () => { validateDisplayName(guestDisplayNameInput) });
};

function detectAuthToken(): void {
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken) {
    return;
  };

  if (!authToken.startsWith('a') || !isValidAuthToken(authToken)) {
    Cookies.remove('authToken');
    return;
  };

  thirdStepState.isSignedIn = true;
  displaySignedInStatus();
};

function displaySignedInStatus(): void {
  const thirdStepFormContainer: HTMLDivElement | null = document.querySelector('#hangout-form-step-3-container');
  thirdStepFormContainer?.classList.add('disabled');

  const signOutBtn: HTMLButtonElement | null = document.querySelector('#already-signed-in-sign-out');
  signOutBtn?.addEventListener('click', removeSignedInStatus);
};

function removeSignedInStatus(e: MouseEvent): void {
  e.preventDefault();

  const thirdStepFormContainer: HTMLDivElement | null = document.querySelector('#hangout-form-step-3-container');
  thirdStepFormContainer?.classList.remove('disabled');

  thirdStepState.isSignedIn = false;
  popup('Signed out.', 'info');

  Cookies.remove('authToken');
};