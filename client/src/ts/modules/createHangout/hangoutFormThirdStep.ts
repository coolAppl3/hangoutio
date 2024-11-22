import axios, { AxiosError, AxiosResponse } from "../../../../node_modules/axios/index";
import { ConfirmModal } from "../global/ConfirmModal";
import Cookies from "../global/Cookies";
import ErrorSpan from "../global/ErrorSpan";
import { InfoModal } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import revealPassword from "../global/revealPassword";
import { signOut } from "../global/signOut";
import { isValidAuthToken, validateConfirmPassword, validateDisplayName, validateEmail, validateNewPassword, validateNewUsername, validatePassword } from "../global/validation";
import { AccountSignInBody, AccountSignInData, accountSignInService } from "../services/accountServices";
import { AccountLeaderHangoutBody, AccountLeaderHangoutData, createAccountLeaderHangoutService, createGuestLeaderHangoutService, GuestLeaderHangoutBody, GuestLeaderHangoutData } from "../services/hangoutServices";
import { displayFirstStepError, hangoutFormNavigationState } from "./hangoutFormNavigation";
import { hangoutFormState } from "./hangoutFormState";

interface HangoutThirdStepState {
  isSignedIn: boolean,
  isGuestUser: boolean,
  keepSignedIn: boolean,
};

const hangoutThirdStepState: HangoutThirdStepState = {
  isSignedIn: false,
  isGuestUser: false,
  keepSignedIn: false,
};

const hangoutForm: HTMLFormElement | null = document.querySelector('#hangout-form');

const accountEmailInput: HTMLInputElement | null = document.querySelector('#account-email-input');
const accountPasswordInput: HTMLInputElement | null = document.querySelector('#account-password-input');
const accountPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#account-password-input-reveal-btn');

const guestDisplayNameInput: HTMLInputElement | null = document.querySelector('#guest-display-name-input');
const guestUsernameInput: HTMLInputElement | null = document.querySelector('#guest-username-input');
const guestPasswordInput: HTMLInputElement | null = document.querySelector('#guest-password-input');
const guestConfirmPasswordInput: HTMLInputElement | null = document.querySelector('#guest-password-confirm-input');

const guestPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#guest-password-input-reveal-btn');
const guestPasswordConfirmRevalBtn: HTMLButtonElement | null = document.querySelector('#guest-password-confirm-input-reveal-btn');

const keepSignedInBtn: HTMLButtonElement | null = document.querySelector('#keep-signed-in-btn');
const accountPreferences: HTMLDivElement | null = document.querySelector('#account-preferences');

export function hangoutFormThirdStep(): void {
  init();
  loadEventListeners();
};

function loadEventListeners(): void {
  hangoutForm?.addEventListener('submit', submitHangout);
  accountPreferences?.addEventListener('click', updateAccountPreferences);
  keepSignedInBtn?.addEventListener('click', updateSignInDurationPreferences);

  accountPasswordRevealBtn?.addEventListener('click', () => revealPassword(accountPasswordRevealBtn));
  guestPasswordRevealBtn?.addEventListener('click', () => revealPassword(guestPasswordRevealBtn));
  guestPasswordConfirmRevalBtn?.addEventListener('click', () => revealPassword(guestPasswordConfirmRevalBtn));
};

function init(): void {
  setActiveInputValidation();
  detectSignedInUser();
};

async function submitHangout(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (hangoutFormNavigationState.currentStep !== 3) {
    popup('Hangout form not completed.', 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutThirdStepState.isGuestUser) {
    await createGuestLeaderHangout();
    return;
  };

  if (hangoutThirdStepState.isSignedIn) {
    await createAccountLeaderHangout();
    return;
  };

  await accountSignIn();
};

async function createAccountLeaderHangout(attemptCount: number = 1): Promise<void> {
  if (attemptCount > 3) {
    popup('Internal server error.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!hangoutFormState.hangoutTitle) {
    displayFirstStepError('Invalid hangout title.', 'title');
    popup('Invalid hangout title.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!hangoutFormState.isPasswordProtected && !hangoutFormState.hangoutPassword) {
    displayFirstStepError('Invalid hangout title.', 'password');
    popup('Invalid hangout password.', 'error');
    LoadingModal.remove();

    return;
  };

  const authToken: string | null = Cookies.get('authToken');

  if (!authToken) {
    signOut();
    hangoutThirdStepState.isSignedIn = false;

    popup('Invalid credentials detected.', 'error');
    LoadingModal.remove();

    return;
  };

  const dayMilliseconds: number = 1000 * 60 * 60 * 24;

  const accountLeaderHangoutBody: AccountLeaderHangoutBody = {
    hangoutTitle: hangoutFormState.hangoutTitle,
    hangoutPassword: hangoutFormState.hangoutPassword,
    memberLimit: hangoutFormState.memberLimit,
    availabilityStep: hangoutFormState.availabilityStep * dayMilliseconds,
    suggestionsStep: hangoutFormState.suggestionsStep * dayMilliseconds,
    votingStep: hangoutFormState.votingStep * dayMilliseconds,
  };

  try {
    const accountLeaderHangoutData: AxiosResponse<AccountLeaderHangoutData> = await createAccountLeaderHangoutService(authToken, accountLeaderHangoutBody);
    const { hangoutId } = accountLeaderHangoutData.data.resData;

    popup('Hangout successfully created.', 'success');
    setTimeout(() => window.location.href = `hangout.html?hangoutId=${hangoutId}`, 1000);

  } catch (err: unknown) {
    console.log(err)

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 409) {
      if (errReason === 'duplicateHangoutId') {
        await createAccountLeaderHangout(++attemptCount);
        return;
      };

      if (errReason === 'hangoutsLimitReached') {
        LoadingModal.remove();
        handleHangoutsLimitReached(errMessage);
      };

      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 401) {
      signOut();
      hangoutThirdStepState.isSignedIn = false;

      popup('Invalid credentials detected.', 'error');
      LoadingModal.remove();

      return;
    };

    if (status === 400) {
      if (errReason === 'hangoutTitle') {
        displayFirstStepError('Invalid hangout title.', 'title');
        return;
      };

      if (errReason === 'hangoutPassword') {
        displayFirstStepError('Invalid hangout title.', 'password');
      };
    };
  };
};

async function createGuestLeaderHangout(attemptCount: number = 1): Promise<void> {
  if (attemptCount > 3) {
    popup('Internal server error.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!hangoutFormState.hangoutTitle) {
    displayFirstStepError('Invalid hangout title.', 'title');
    popup('Invalid hangout title.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!hangoutFormState.isPasswordProtected && !hangoutFormState.hangoutPassword) {
    displayFirstStepError('Invalid hangout title.', 'password');
    popup('Invalid hangout password.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!guestDisplayNameInput || !guestUsernameInput || !guestPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!isValidGuestDetails()) {
    popup('Invalid guest sign up details.', 'error');
    LoadingModal.remove();

    return;
  };

  const dayMilliseconds: number = 1000 * 60 * 60 * 24;

  const guestLeaderHangoutBody: GuestLeaderHangoutBody = {
    hangoutTitle: hangoutFormState.hangoutTitle,
    hangoutPassword: hangoutFormState.hangoutPassword,
    memberLimit: hangoutFormState.memberLimit,
    availabilityStep: hangoutFormState.availabilityStep * dayMilliseconds,
    suggestionsStep: hangoutFormState.suggestionsStep * dayMilliseconds,
    votingStep: hangoutFormState.votingStep * dayMilliseconds,
    displayName: guestDisplayNameInput.value,
    username: guestUsernameInput.value,
    password: guestPasswordInput.value,
  };

  try {
    const guestLeaderHangoutData: AxiosResponse<GuestLeaderHangoutData> = await createGuestLeaderHangoutService(guestLeaderHangoutBody);
    const { authToken, hangoutId } = guestLeaderHangoutData.data.resData;

    if (hangoutThirdStepState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, daySeconds);
      Cookies.set('guestHangoutId', hangoutId, daySeconds);

    } else {
      Cookies.set('authToken', authToken);
      Cookies.set('guestHangoutId', authToken);
    };

    popup('Hangout successfully created.', 'success');
    setTimeout(() => window.location.replace(`hangout.html?hangoutId=${hangoutId}`), 1000);

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    if (status === 409 && errReason === 'duplicateHangoutId') {
      await createGuestLeaderHangout(++attemptCount);
      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 409 && errReason === 'guestUsernameTaken') {
      ErrorSpan.display(guestUsernameInput, errMessage);
      return;
    };

    if (status === 400) {
      const inputRecord: Record<string, HTMLInputElement | undefined> = {
        guestDisplayName: guestDisplayNameInput,
        username: guestUsernameInput,
        guestPassword: guestPasswordInput,
      };

      const input: HTMLInputElement | undefined = inputRecord[`${errReason}`];
      if (input) {
        ErrorSpan.display(input, errMessage);
        return;
      };

      if (errReason === 'hangoutTitle') {
        displayFirstStepError(errMessage, 'title');
        return;
      };

      if (errReason === 'hangoutPassword') {
        displayFirstStepError(errMessage, 'password');
      };
    };
  };
};

async function accountSignIn(): Promise<void> {
  if (!accountEmailInput || !accountPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!isValidAccountDetails()) {
    popup('Invalid account sign in details.', 'error');
    LoadingModal.remove();

    return;
  };

  const accountSignInBody: AccountSignInBody = {
    email: accountEmailInput.value,
    password: accountPasswordInput.value,
  };

  try {
    const accountSignInData: AxiosResponse<AccountSignInData> = await accountSignInService(accountSignInBody);
    const { authToken } = accountSignInData.data.resData;

    if (hangoutThirdStepState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, 14 * daySeconds);

    } else {
      Cookies.set('authToken', authToken);
    };

    await createAccountLeaderHangout();

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 401) {
      if (errReason === 'accountLocked') {
        handleAccountLocked();
        return;
      };

      ErrorSpan.display(accountPasswordInput, errMessage);
      return;
    };

    if (status === 403 || status === 404) {
      ErrorSpan.display(accountEmailInput, errMessage);
      return;
    };

    if (status === 400) {
      const inputRecord: Record<string, HTMLInputElement | undefined> = {
        email: accountEmailInput,
        password: accountPasswordInput,
      };

      const input: HTMLInputElement | undefined = inputRecord[`${errReason}`];
      if (input) {
        ErrorSpan.display(input, errMessage);
      };
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

  const validationArray: boolean[] = [
    validateDisplayName(guestDisplayNameInput),
    validateNewUsername(guestUsernameInput),
    validateNewPassword(guestPasswordInput),
    validateConfirmPassword(guestConfirmPasswordInput, guestPasswordInput),
  ];

  if (validationArray.includes(false)) {
    return false;
  };

  if (guestPasswordInput.value === guestUsernameInput.value) {
    ErrorSpan.display(guestPasswordInput, `Your password can't be identical to your username.`);
    return false;
  };

  return true;
};

// navigation
function updateAccountPreferences(e: MouseEvent): void {
  if (!(e.target instanceof HTMLElement)) {
    return;
  };

  if (e.target.id === `account-option-btn`) {
    switchToAccountForm();
    return;
  };

  if (e.target.id === `guest-option-btn`) {
    switchToGuestForm();
  };
};

function switchToAccountForm(): void {
  if (!hangoutThirdStepState.isGuestUser) {
    return;
  };

  hangoutThirdStepState.isGuestUser = false;

  hangoutForm?.classList.remove('is-guest-user');
  accountPreferences?.classList.remove('guest');

  clearGuestForm();
};

function switchToGuestForm(): void {
  if (hangoutThirdStepState.isGuestUser) {
    return;
  };

  hangoutThirdStepState.isGuestUser = true;

  hangoutForm?.classList.add('is-guest-user');
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

function updateSignInDurationPreferences(): void {
  hangoutThirdStepState.keepSignedIn = !hangoutThirdStepState.keepSignedIn

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

  if (!isValidAuthToken(authToken)) {
    signOut();
    return;
  };

  if (authToken.startsWith('a')) {
    hangoutThirdStepState.isSignedIn = true;
    displaySignedInStatus();

    return;
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Signed in as a guest.',
    description: `You must sign out of your guest account before creating a new hangout.\nGuest accounts can only be used within the hangout they were created for.`,
    confirmBtnTitle: 'Sign out',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      signOut();
      popup('Successfully signed out.', 'success');
      ConfirmModal.remove();

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      const referrerHref: string = document.referrer;

      if (referrerHref === '' || referrerHref === window.location.href) {
        window.location.href = 'index.html';
        return;
      };

      window.location.href = referrerHref;
    };
  });
};

function displaySignedInStatus(): void {
  const thirdStepFormContainer: HTMLDivElement | null = document.querySelector('#hangout-form-step-3-container');
  thirdStepFormContainer?.classList.add('disabled');

  const signOutBtn: HTMLButtonElement | null = document.querySelector('#already-signed-in-sign-out');
  signOutBtn?.addEventListener('click', removeSignedInStatus);
};

function removeSignedInStatus(): void {
  const thirdStepFormContainer: HTMLDivElement | null = document.querySelector('#hangout-form-step-3-container');
  thirdStepFormContainer?.classList.remove('disabled');

  hangoutThirdStepState.isSignedIn = false;
  popup('Signed out.', 'success');

  signOut();
};

function handleHangoutsLimitReached(errMessage: string): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: errMessage,
    description: `To create or join a new hangout, wait for one of your current hangouts to conclude or leave one to make room.`,
    btnTitle: 'Go to my account',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'account.html';
    };
  });
};

function handleAccountLocked(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Account locked.',
    description: `Your account has been locked due to multiple failed sign in attempts.`,
    confirmBtnTitle: 'Recover my account',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      window.location.href = 'account-recovery.html';
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'index.html';
    };
  });
};