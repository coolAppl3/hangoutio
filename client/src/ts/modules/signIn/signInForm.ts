import { isValidHangoutId, validateEmail, validatePassword, validateUsername } from '../global/validation';
import revealPassword from '../global/revealPassword';
import ErrorSpan from '../global/ErrorSpan';
import Cookies from '../global/Cookies';
import LoadingModal from '../global/LoadingModal';
import popup from '../global/popup';
import { AccountSignInBody, accountSignInService } from '../services/accountServices';
import axios, { AxiosError } from '../../../../node_modules/axios/index';
import { GuestSignInBody, guestSignInService } from '../services/guestServices';
import { InfoModal } from '../global/InfoModal';
import { ConfirmModal } from '../global/ConfirmModal';

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
const keepSignedInBtn: HTMLButtonElement | null = document.querySelector('#keep-signed-in-btn');

const accountEmailInput: HTMLInputElement | null = document.querySelector('#account-email-input');
const accountPasswordInput: HTMLInputElement | null = document.querySelector('#account-password-input');
const accountPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#account-password-input-reveal-btn');

const guestUsernameInput: HTMLInputElement | null = document.querySelector('#guest-username-input');
const guestPasswordInput: HTMLInputElement | null = document.querySelector('#guest-password-input');
const guestPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#guest-password-input-reveal-btn');

export function signInForm(): void {
  init();
  loadEventListeners();
};

function init(): void {
  setActiveValidation();
  redirectSignedInUser();
};

function loadEventListeners(): void {
  signInFormElement?.addEventListener('submit', submitForm);
  signInOptions?.addEventListener('click', updateSignInOption);
  keepSignedInBtn?.addEventListener('click', updateSignedInDurationPreferences);

  accountPasswordRevealBtn?.addEventListener('click', () => revealPassword(accountPasswordRevealBtn));
  guestPasswordRevealBtn?.addEventListener('click', () => revealPassword(guestPasswordRevealBtn));
};

async function submitForm(e: SubmitEvent): Promise<void> {
  e.preventDefault();

  if (signInFormState.isGuestUser) {
    await guestSignIn();
    return;
  };

  await accountSignIn();
};

async function accountSignIn(): Promise<void> {
  LoadingModal.display();

  if (!isValidAccountDetails()) {
    popup('Invalid account sign in details.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!accountEmailInput || !accountPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const accountSignInBody: AccountSignInBody = {
    email: accountEmailInput.value,
    password: accountPasswordInput.value,
    keepSignedIn: signInFormState.keepSignedIn,
  };

  try {
    await accountSignInService(accountSignInBody);
    popup('Signed in successfully.', 'success');

    const afterAuthRedirectHref: string | null = Cookies.get('afterAuthRedirectHref');
    if (afterAuthRedirectHref) {
      Cookies.remove('afterAuthRedirectHref');
      setTimeout(() => window.location.replace(afterAuthRedirectHref), 1000);

      return;
    };

    const pendingHangoutId: string | null = getPendingSignInHangoutId();
    if (pendingHangoutId) {
      LoadingModal.remove();
      offerHangoutRedirect(pendingHangoutId);

      return;
    };

    setTimeout(() => window.location.replace('account'), 1000);

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    popup(errMessage, 'error');

    if (status === 401) {
      ErrorSpan.display(accountPasswordInput, errMessage);
      return;
    };

    if (status === 404) {
      ErrorSpan.display(accountEmailInput, errMessage);
      return;
    };

    if (status === 403) {
      ErrorSpan.display(accountEmailInput, errMessage);

      if (errReason === 'accountLocked') {
        handleAccountLocked();
        return;
      };

      if (errReason === 'unverified') {
        InfoModal.display({
          title: 'Account unverified.',
          description: 'You must verify your account to sign in.\nCheck your inbox for a verification email.',
          btnTitle: 'Okay',
        }, { simple: true });
      };

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

async function guestSignIn(): Promise<void> {
  LoadingModal.display();

  if (!isValidGuestDetails()) {
    popup('Invalid guest sign in details.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!guestUsernameInput || !guestPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const guestSignInBody: GuestSignInBody = {
    username: guestUsernameInput.value,
    password: guestPasswordInput.value,
  };

  try {
    await guestSignInService(guestSignInBody);
    const guestHangoutId: string | null = Cookies.get('guestHangoutId');

    if (!guestHangoutId) {
      popup('Internal server error.', 'error');
      LoadingModal.remove();

      return;
    };

    popup('Signed in successfully.', 'success');

    const afterAuthRedirectHref: string | null = Cookies.get('afterAuthRedirectHref');
    if (afterAuthRedirectHref) {
      setTimeout(() => window.location.replace(afterAuthRedirectHref), 1000);
      return;
    };

    setTimeout(() => window.location.replace(`hangout?id=${guestHangoutId}`), 1000);

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    popup(errMessage, 'error');

    if (status === 404) {
      ErrorSpan.display(guestUsernameInput, errMessage);
      return;
    };

    if (status === 401) {
      ErrorSpan.display(guestPasswordInput, errMessage);
      return;
    };

    if (status === 400) {
      const inputRecord: Record<string, HTMLInputElement | undefined> = {
        invalidUsername: guestUsernameInput,
        invalidPassword: guestPasswordInput,
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
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'account-option-btn') {
    switchToAccountForm();
    return;
  };

  if (e.target.id === 'guest-option-btn') {
    switchToGuestForm();
  };
};

function switchToAccountForm(): void {
  if (!signInFormState.isGuestUser) {
    return;
  };

  signInFormState.isGuestUser = false;

  signInFormElement?.classList.remove('is-guest-user');
  signInOptions?.classList.remove('guest');

  clearGuestForm();
};

function switchToGuestForm(): void {
  if (signInFormState.isGuestUser) {
    return;
  };

  signInFormState.isGuestUser = true;

  signInFormElement?.classList.add('is-guest-user');
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

function redirectSignedInUser(): void {
  const signedInAs: string | null = Cookies.get('signedInAs');

  if (!signedInAs) {
    return;
  };

  if (signedInAs === 'guest') {
    window.location.replace('hangout');
    return;
  };

  window.location.replace('account');
};

function updateSignedInDurationPreferences(): void {
  signInFormState.keepSignedIn = !signInFormState.keepSignedIn;

  if (keepSignedInBtn?.classList.contains('checked')) {
    keepSignedInBtn.classList.remove('checked');
    return;
  };

  keepSignedInBtn?.classList.add('checked');
};

function handleAccountLocked(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Account locked.',
    description: `Your account has been locked due to multiple failed sign in attempts.`,
    confirmBtnTitle: 'Recover account',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      window.location.href = 'account-recovery';
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'home';
    };
  });
};

function getPendingSignInHangoutId(): string | null {
  const pendingHangoutId: string | null = Cookies.get('pendingSignInHangoutId');

  if (!pendingHangoutId) {
    return null;
  };

  if (!isValidHangoutId(pendingHangoutId)) {
    return null;
  };

  return pendingHangoutId;
};

function offerHangoutRedirect(hangoutId: string): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Hangout ID found.',
    description: `You've attempted to access a hangout earlier.\nWould you like to try again now that you're signed in?`,
    confirmBtnTitle: 'Yes',
    cancelBtnTitle: 'Go to my account',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      Cookies.remove('pendingSignInHangoutId');
      window.location.href = `hangout?id=${hangoutId}`;

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      Cookies.remove('pendingSignInHangoutId');
      window.location.href = 'account';
    };
  });
};