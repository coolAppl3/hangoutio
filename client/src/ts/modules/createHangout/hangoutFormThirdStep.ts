import axios, { AxiosError } from "../../../../node_modules/axios/index";
import { ConfirmModal } from "../global/ConfirmModal";
import Cookies from "../global/Cookies";
import ErrorSpan from "../global/ErrorSpan";
import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../global/authUtils";
import { InfoModal } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import revealPassword from "../global/revealPassword";
import { signOut } from "../global/signOut";
import { validateConfirmPassword, validateDisplayName, validateEmail, validateNewPassword, validateNewUsername, validatePassword } from "../global/validation";
import { AccountSignInBody, accountSignInService } from "../services/accountServices";
import { CreateHangoutAsAccountBody, createHangoutAsAccountService, createHangoutAsGuestService, CreateHangoutAsGuestBody } from "../services/hangoutServices";
import { displayFirstStepError, hangoutFormNavigationState } from "./hangoutFormNavigation";
import { hangoutFormState } from "./hangoutFormState";
import { dayMilliseconds } from "../global/clientConstants";

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
    LoadingModal.remove();
    return;
  };

  if (hangoutThirdStepState.isGuestUser) {
    await createHangoutAsGuest();
    return;
  };

  if (hangoutThirdStepState.isSignedIn) {
    await createHangoutAsAccount();
    return;
  };

  await accountSignIn();
};

async function createHangoutAsAccount(attemptCount: number = 1): Promise<void> {
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

  if (hangoutFormState.isPasswordProtected && !hangoutFormState.hangoutPassword) {
    displayFirstStepError('Invalid hangout password.', 'password');
    popup('Invalid hangout password.', 'error');
    LoadingModal.remove();

    return;
  };

  const accountLeaderHangoutBody: CreateHangoutAsAccountBody = {
    hangoutTitle: hangoutFormState.hangoutTitle,
    hangoutPassword: hangoutFormState.hangoutPassword,
    membersLimit: hangoutFormState.membersLimit,
    availabilityPeriod: hangoutFormState.availabilityPeriodDays * dayMilliseconds,
    suggestionsPeriod: hangoutFormState.suggestionsPeriodDays * dayMilliseconds,
    votingPeriod: hangoutFormState.votingPeriodDays * dayMilliseconds,
  };

  try {
    const hangoutId: string = (await createHangoutAsAccountService(accountLeaderHangoutBody)).data.hangoutId;

    popup('Hangout successfully created.', 'success');
    setTimeout(() => window.location.href = `hangout?id=${hangoutId}`, 1000);

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

    if (status === 409 && errReason === 'duplicationHangoutId') {
      await createHangoutAsAccount(++attemptCount);
      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 409 && errReason === 'hangoutsLimitReached') {
      handleOngoingHangoutsLimitReached(errMessage);
      return;
    };

    if (status === 401) {
      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      if (errReason === 'authSessionDestroyed') {
        handleAuthSessionDestroyed();
      };

      return;
    };

    if (status === 400) {
      if (errReason === 'invalidHangoutTitle') {
        displayFirstStepError('Invalid hangout title.', 'title');
        return;
      };

      if (errReason === 'invalidHangoutPassword') {
        displayFirstStepError('Invalid hangout password.', 'password');
      };
    };
  };
};

async function createHangoutAsGuest(attemptCount: number = 1): Promise<void> {
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

  if (hangoutFormState.isPasswordProtected && !hangoutFormState.hangoutPassword) {
    displayFirstStepError('Invalid hangout password.', 'password');

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

  const guestLeaderHangoutBody: CreateHangoutAsGuestBody = {
    hangoutTitle: hangoutFormState.hangoutTitle,
    hangoutPassword: hangoutFormState.hangoutPassword,
    membersLimit: hangoutFormState.membersLimit,
    availabilityPeriod: hangoutFormState.availabilityPeriodDays * dayMilliseconds,
    suggestionsPeriod: hangoutFormState.suggestionsPeriodDays * dayMilliseconds,
    votingPeriod: hangoutFormState.votingPeriodDays * dayMilliseconds,
    displayName: guestDisplayNameInput.value,
    username: guestUsernameInput.value,
    password: guestPasswordInput.value,
  };

  try {
    const { authSessionCreated, hangoutId } = (await createHangoutAsGuestService(guestLeaderHangoutBody)).data;
    const redirectHref: string = authSessionCreated ? `hangout?id=${hangoutId}` : 'sign-in';

    popup('Hangout successfully created.', 'success');
    setTimeout(() => window.location.replace(redirectHref), 1000);

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
      await createHangoutAsGuest(++attemptCount);
      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    const inputRecord: Record<string, HTMLInputElement | undefined> = {
      guestUsernameTaken: guestUsernameInput,
      invalidDisplayName: guestDisplayNameInput,
      invalidUsername: guestUsernameInput,
      invalidGuestPassword: guestPasswordInput,
      passwordEqualsUsername: guestPasswordInput,
    };

    if (status === 409) {
      const input: HTMLInputElement | undefined = inputRecord[`${errReason}`];
      if (input) {
        ErrorSpan.display(input, errMessage);
      };

      return;
    };

    if (status === 400) {
      const input: HTMLInputElement | undefined = inputRecord[`${errReason}`];
      if (input) {
        ErrorSpan.display(input, errMessage);
        return;
      };

      if (errReason === 'invalidHangoutTitle') {
        displayFirstStepError(errMessage, 'title');
        return;
      };

      if (errReason === 'invalidHangoutPassword') {
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
    keepSignedIn: hangoutThirdStepState.keepSignedIn,
  };

  try {
    await accountSignInService(accountSignInBody);
    await createHangoutAsAccount();

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

    if (status === 403 || status === 404) {
      ErrorSpan.display(accountEmailInput, errMessage);
      return;
    };

    if (status === 400) {
      const inputRecord: Record<string, HTMLInputElement | undefined> = {
        invalidEmail: accountEmailInput,
        invalidPassword: accountPasswordInput,
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
  const inputArray: (HTMLInputElement | null)[] = [accountEmailInput, accountPasswordInput];

  for (const input of inputArray) {
    if (!input) {
      continue;
    };

    ErrorSpan.hide(input);
    input.value = '';
  };
};

function clearGuestForm(): void {
  const inputArray: (HTMLInputElement | null)[] = [guestDisplayNameInput, guestUsernameInput, guestPasswordInput, guestConfirmPasswordInput];

  for (const input of inputArray) {
    if (!input) {
      continue;
    };

    ErrorSpan.hide(input);
    input.value = '';
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
    guestConfirmPasswordInput && validateConfirmPassword(guestConfirmPasswordInput, guestPasswordInput);
  });

  guestConfirmPasswordInput?.addEventListener('input', () => {
    guestPasswordInput && validateConfirmPassword(guestConfirmPasswordInput, guestPasswordInput);
  });
};

function detectSignedInUser(): void {
  const signedInAs: string | null = Cookies.get('signedInAs');

  if (!signedInAs) {
    return;
  };

  if (signedInAs === 'account') {
    hangoutThirdStepState.isSignedIn = true;
    displaySignedInStatus();

    return;
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: `You're signed in as a guest.`,
    description: `You must sign out of your guest account before creating a new hangout.\nGuest accounts can only be used within the hangout they were created for.`,
    confirmBtnTitle: 'Sign out',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      await signOut();
      ConfirmModal.remove();

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'home';
    };
  });
};

function displaySignedInStatus(): void {
  const thirdStepFormContainer: HTMLDivElement | null = document.querySelector('#hangout-form-step-3-container');
  thirdStepFormContainer?.classList.add('disabled');

  const signOutBtn: HTMLButtonElement | null = document.querySelector('#already-signed-in-sign-out');
  signOutBtn?.addEventListener('click', handleUserSignOut);
};

function handleUserSignOut(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Are you sure you want to sign out?',
    description: null,
    confirmBtnTitle: 'Sign out',
    cancelBtnTitle: 'Cancel',
    extraBtnTitle: null,
    isDangerousAction: true,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      const thirdStepFormContainer: HTMLDivElement | null = document.querySelector('#hangout-form-step-3-container');
      thirdStepFormContainer?.classList.remove('disabled');

      hangoutThirdStepState.isSignedIn = false;
      await signOut();

      ConfirmModal.remove();
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};

function handleOngoingHangoutsLimitReached(errMessage: string): void {
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
      window.location.href = 'account';
    };
  });
};