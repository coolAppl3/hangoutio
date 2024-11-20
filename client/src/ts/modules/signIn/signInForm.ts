import { isValidAuthToken, isValidHangoutId, validateEmail, validatePassword, validateUsername } from '../global/validation';
import revealPassword from '../global/revealPassword';
import ErrorSpan from '../global/ErrorSpan';
import Cookies from '../global/Cookies';
import LoadingModal from '../global/LoadingModal';
import popup from '../global/popup';
import { AccountSignInBody, AccountSignInData, accountSignInService } from '../services/accountServices';
import axios, { AxiosError, AxiosResponse } from '../../../../node_modules/axios/index';
import { GuestSignInBody, GuestSignInData, guestSignInService } from '../services/guestServices';
import { signOut } from '../global/signOut';
import { InfoModal, InfoModalConfig } from '../global/InfoModal';
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
  };

  try {
    const accountSignInData: AxiosResponse<AccountSignInData> = await accountSignInService(accountSignInBody);
    const { authToken } = accountSignInData.data.resData;

    if (signInFormState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, 14 * daySeconds);

    } else {
      Cookies.set('authToken', authToken);
    };

    popup('Signed in successfully.', 'success');

    const pendingHangoutId: string | null = getPendingSignInHangoutId();
    if (pendingHangoutId) {
      LoadingModal.remove();
      offerHangoutRedirect(pendingHangoutId);

      return;
    };

    setTimeout(() => window.location.replace('account.html'), 1000);

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

    if (status === 400) {
      if (errReason === 'email') {
        ErrorSpan.display(accountEmailInput, errMessage);
        return;
      };

      if (errReason === 'password') {
        ErrorSpan.display(accountPasswordInput, errMessage);
        return;
      };

      return;
    };

    if ((status === 404)) {
      ErrorSpan.display(accountEmailInput, errMessage);
      return;
    };

    if (status === 403) {
      ErrorSpan.display(accountEmailInput, errMessage);

      if (errReason === 'accountLocked') {
        displayAccountLockedModal();
        return;
      };

      if (errReason === 'unverified') {
        const infoModalConfig: InfoModalConfig = {
          title: errMessage,
          description: `You need to first verify your account before being able to sign in.\nCheck your inbox for a verification email.`,
          btnTitle: 'Okay',
        };

        InfoModal.display(infoModalConfig, { simple: true });
        return;
      };

      return;
    };

    if (status === 401) {
      ErrorSpan.display(accountPasswordInput, errMessage);

      if (errReason === 'accountLocked') {
        displayAccountLockedModal();
      };
    };
  };
};

async function guestSignIn(): Promise<void> {
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
    const guestSignInData: AxiosResponse<GuestSignInData> = await guestSignInService(guestSignInBody);
    const { authToken, hangoutId } = guestSignInData.data.resData;

    if (signInFormState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;

      Cookies.set('authToken', authToken, 14 * daySeconds);
      Cookies.set('guestHangoutId', hangoutId, 14 * daySeconds);

    } else {
      Cookies.set('authToken', authToken);
      Cookies.set('guestHangoutId', hangoutId);
    };

    popup('Signed in successfully.', 'success');
    setTimeout(() => window.location.replace(`hangout.html?id=${hangoutId}`), 1000);

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

    if (status === 400) {
      if (errReason === 'username') {
        ErrorSpan.display(guestUsernameInput, errMessage);
        return;
      };

      if (errReason === 'password') {
        ErrorSpan.display(guestPasswordInput, errMessage);
        return;
      };

      return;
    };

    if (status === 401) {
      ErrorSpan.display(guestPasswordInput, errMessage);
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
  if (!(e.target instanceof HTMLElement)) {
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
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken) {
    return;
  };

  if (!isValidAuthToken(authToken)) {
    signOut();
    return;
  };

  if (authToken.startsWith('g')) {
    window.location.replace('hangout.html');
    return;
  };

  window.location.replace('account.html');
};

function updateSignedInDurationPreferences(): void {
  signInFormState.keepSignedIn = !signInFormState.keepSignedIn;

  if (keepSignedInBtn?.classList.contains('checked')) {
    keepSignedInBtn.classList.remove('checked');
    return;
  };

  keepSignedInBtn?.classList.add('checked');
};

function displayAccountLockedModal(): void {
  const infoModalConfig: InfoModalConfig = {
    title: 'Your account has been locked due to multiple failed sign in attempts.',
    description: `You can recover your account by clicking the "Forgot my password" link at the end of the form.`,
    btnTitle: 'Okay',
  };

  InfoModal.display(infoModalConfig, { simple: true });
};

function getPendingSignInHangoutId(): string | null {
  const pendingHangoutId: string | null = sessionStorage.getItem('pendingSignInHangoutId');

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
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      window.location.href = `hangout.html?hangoutId=${hangoutId}`;
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      sessionStorage.removeItem('pendingSignInHangoutId');
      window.location.href = 'account.html';
    };
  });
};