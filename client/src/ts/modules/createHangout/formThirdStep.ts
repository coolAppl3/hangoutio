import axios, { AxiosError } from "../../../../node_modules/axios/index";
import { ConfirmModal, ConfirmModalConfig } from "../global/ConfirmModal";
import Cookies from "../global/Cookies";
import ErrorSpan from "../global/ErrorSpan";
import { getAuthToken } from "../global/getAuthToken";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import revealPassword from "../global/revealPassword";
import { signOut } from "../global/signOut";
import { validateConfirmPassword, validateDisplayName, validateEmail, validateNewPassword, validateNewUsername, validatePassword } from "../global/validation";
import { AccountSignInBody, AccountSignInData, accountSignInService } from "../services/accountServices";
import { AccountLeaderHangoutBody, AccountLeaderHangoutData, createAccountLeaderHangoutService, createGuestLeaderHangoutService, GuestLeaderHangoutBody, GuestLeaderHangoutData } from "../services/hangoutServices";
import { formState } from "./formState";

interface ThirdStepState {
  isSignedIn: boolean,
  isGuestUser: boolean,
  keepSignedIn: boolean,
};

const thirdStepState: ThirdStepState = {
  isSignedIn: false,
  isGuestUser: false,
  keepSignedIn: false,
};


const hangoutForm: HTMLFormElement | null = document.querySelector('#hangout-form');
const accountForm: HTMLDivElement | null = document.querySelector('#account-form');
const guestForm: HTMLDivElement | null = document.querySelector('#guest-form');

const accountEmailInput: HTMLInputElement | null = document.querySelector('#account-email-input');
const accountPasswordInput: HTMLInputElement | null = document.querySelector('#account-password-input');
const accountPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#account-password-input-reveal-btn');

const guestDisplayNameInput: HTMLInputElement | null = document.querySelector('#guest-display-name-input');
const guestUsernameInput: HTMLInputElement | null = document.querySelector('#guest-username-input');
const guestPasswordInput: HTMLInputElement | null = document.querySelector('#guest-password-input');
const guestConfirmPasswordInput: HTMLInputElement | null = document.querySelector('#guest-password-confirm-input');
const guestPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#guest-password-input-reveal-btn');

const keepSignedInBtn: HTMLButtonElement | null = document.querySelector('#keep-signed-in-btn');
const accountPreferences: HTMLDivElement | null = document.querySelector('#account-preferences');
const accountOptionBtn: HTMLButtonElement | null = document.querySelector('#account-option-btn');
const guestOptionBtn: HTMLButtonElement | null = document.querySelector('#guest-option-btn');

export function formThirdStep(): void {
  init();
  loadEventListeners();
};

function loadEventListeners(): void {
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
  detectSignedInUser();
};

async function submitHangout(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  const authToken: string | null = getAuthToken();
  if (authToken && authToken.startsWith('g')) {
    signOut();
  };

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

  if (!formState.hangoutTitle) {
    popup('Invalid hangout title.', 'error');
    return;
  };

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

    if (thirdStepState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, 14 * daySeconds);

    } else {
      Cookies.set('authToken', authToken);
    };

    const dayMilliseconds: number = 1000 * 60 * 60 * 24;

    const accountLeaderHangoutBody: AccountLeaderHangoutBody = {
      hangoutTitle: formState.hangoutTitle,
      hangoutPassword: formState.hangoutPassword,
      memberLimit: formState.memberLimit,
      availabilityStep: formState.availabilityStep * dayMilliseconds,
      suggestionsStep: formState.suggestionsStep * dayMilliseconds,
      votingStep: formState.votingStep * dayMilliseconds,
    };

    const accountLeaderHangoutData: AccountLeaderHangoutData = await createAccountLeaderHangoutService(authToken, accountLeaderHangoutBody);
    const { hangoutID } = accountLeaderHangoutData.data.resData;

    popup('Hangout created.', 'success', 1000);
    setTimeout(() => window.location.href = `hangout.html?id=${hangoutID}`, 1000);

  } catch (err: unknown) {
    console.log(err)

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

  const authToken: string | null = getAuthToken();

  if (!authToken) {
    popup('Not signed in.', 'error');
    return;
  };

  if (!formState.hangoutTitle) {
    popup('Hangout title is required.', 'error');
    return;
  };

  const dayMilliseconds: number = 1000 * 60 * 60 * 24;

  const accountLeaderHangoutBody: AccountLeaderHangoutBody = {
    hangoutTitle: formState.hangoutTitle,
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

      return;
    };
  };
};

async function createGuestLeaderHangout(attemptCount: number = 1): Promise<void> {
  if (attemptCount > 2) {
    popup('Internal server error.', 'error');
    LoadingModal.hide();

    return;
  };

  if (!formState.hangoutTitle) {
    popup('Hangout title is required.', 'error');
    return;
  };

  if (!isValidGuestDetails()) {
    popup('Invalid guest sign up details.', 'error');
    LoadingModal.hide();

    return;
  };

  if (!guestDisplayNameInput || !guestUsernameInput || !guestPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.hide();

    return;
  };

  const dayMilliseconds: number = 1000 * 60 * 60 * 24;

  const guestLeaderHangoutBody: GuestLeaderHangoutBody = {
    hangoutTitle: formState.hangoutTitle,
    hangoutPassword: formState.hangoutPassword,
    memberLimit: formState.memberLimit,
    availabilityStep: formState.availabilityStep * dayMilliseconds,
    suggestionsStep: formState.suggestionsStep * dayMilliseconds,
    votingStep: formState.votingStep * dayMilliseconds,
    displayName: guestDisplayNameInput.value,
    username: guestUsernameInput.value,
    password: guestPasswordInput.value,
  };

  try {
    const guestLeaderHangoutData: GuestLeaderHangoutData = await createGuestLeaderHangoutService(guestLeaderHangoutBody);
    const { authToken, hangoutID } = guestLeaderHangoutData.data.resData;

    if (thirdStepState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, daySeconds);
      Cookies.set('guestHangoutID', hangoutID, daySeconds);

    } else {
      Cookies.set('authToken', authToken);
      Cookies.set('guestHangoutID', authToken);
    };

    popup('Hangout created.', 'success', 1000);
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
  if (!guestDisplayNameInput || !guestUsernameInput || !guestPasswordInput || !guestConfirmPasswordInput) {
    return false;
  };

  const isValidGuestDisplayName: boolean = validateDisplayName(guestDisplayNameInput);
  const isValidGuestUsername: boolean = validateNewUsername(guestUsernameInput);
  const isValidGuestPassword: boolean = validateNewPassword(guestPasswordInput);
  const isValidGuestConfirmPassword: boolean = validateConfirmPassword(guestConfirmPasswordInput, guestPasswordInput);

  if (!isValidGuestDisplayName || !isValidGuestUsername || !isValidGuestPassword || !isValidGuestConfirmPassword) {
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
  };

  if (accountPasswordInput) {
    ErrorSpan.hide(accountPasswordInput);
    accountPasswordInput.value = '';
  };
};

function clearGuestForm(): void {
  if (guestUsernameInput) {
    ErrorSpan.hide(guestUsernameInput);
    guestUsernameInput.value = '';
  };

  if (guestPasswordInput) {
    ErrorSpan.hide(guestPasswordInput);
    guestPasswordInput.value = '';
  };

  if (guestDisplayNameInput) {
    ErrorSpan.hide(guestDisplayNameInput);
    guestDisplayNameInput.value = '';
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
  accountEmailInput?.addEventListener('input', () => validateEmail(accountEmailInput));
  accountPasswordInput?.addEventListener('input', () => validatePassword(accountPasswordInput));

  guestDisplayNameInput?.addEventListener('input', () => validateDisplayName(guestDisplayNameInput));
  guestUsernameInput?.addEventListener('input', () => validateNewUsername(guestUsernameInput));

  guestPasswordInput?.addEventListener('input', () => {
    validateNewPassword(guestPasswordInput);
    guestConfirmPasswordInput ? validateConfirmPassword(guestConfirmPasswordInput, guestPasswordInput) : undefined;
  });

  guestConfirmPasswordInput?.addEventListener('input', () => {
    guestPasswordInput ? validateConfirmPassword(guestConfirmPasswordInput, guestPasswordInput) : undefined;
  });
};

function detectSignedInUser(): void {
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken) {
    return;
  };

  if (authToken.startsWith('a')) {
    thirdStepState.isSignedIn = true;
    displaySignedInStatus();

    return;
  };

  const confirmModalConfig: ConfirmModalConfig = {
    title: 'You need to sign out of your guest account to create a new hangout.',
    description: null,
    confirmBtnTitle: 'Sign out',
    cancelBtnTitle: 'Take me back',
    extraBtnTitle: null,
    isDangerousAction: false,
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display(confirmModalConfig);
  confirmModal.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();

    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      const previousPage: string = document.referrer;

      if (previousPage === '' || previousPage === window.location.href) {
        window.location.href = 'index.html';
        return;
      };

      window.location.href = previousPage;
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      signOut();
      ConfirmModal.remove();
    };
  });

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
  popup('Signed out successfully.', 'success');

  signOut();
};