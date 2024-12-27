import { signUpState } from "./signUpState";
import axios, { AxiosError, AxiosResponse } from "../../../../node_modules/axios/index";
import { ConfirmModal } from "../global/ConfirmModal";
import Cookies from "../global/Cookies";
import ErrorSpan from "../global/ErrorSpan";
import popup from "../global/popup";
import revealPassword from "../global/revealPassword";
import { signOut } from "../global/signOut";
import { validateConfirmPassword, validateDisplayName, validateEmail, validateNewPassword, validateNewUsername } from "../global/validation";
import { AccountSignUpBody, AccountSignUpData, accountSignUpService } from "../services/accountServices";
import { switchToVerificationStage } from "./signUpUtils";
import LoadingModal from "../global/LoadingModal";

const signUpFormElement: HTMLFormElement | null = document.querySelector('#sign-up-form');

const emailInput: HTMLInputElement | null = document.querySelector('#email-input');
const displayNameInput: HTMLInputElement | null = document.querySelector('#display-name-input');
const usernameInput: HTMLInputElement | null = document.querySelector('#username-input');
const passwordInput: HTMLInputElement | null = document.querySelector('#password-input');
const confirmPasswordInput: HTMLInputElement | null = document.querySelector('#confirm-password-input');

const passwordRevealBtn: HTMLButtonElement | null = document.querySelector('#password-input-reveal-btn');
const confirmPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#confirm-password-input-reveal-btn');
const keepSignedInBtn: HTMLButtonElement | null = document.querySelector('#keep-signed-in-btn');

export function signUpForm(): void {
  loadEventListeners();
  init();
};

async function init(): Promise<void> {
  setActiveValidation();
  detectSignedInUser();
};

function loadEventListeners(): void {
  signUpFormElement?.addEventListener('submit', signUp);
  keepSignedInBtn?.addEventListener('click', updateSignInDurationPreferences);

  passwordRevealBtn?.addEventListener('click', () => revealPassword(passwordRevealBtn));
  confirmPasswordRevealBtn?.addEventListener('click', () => revealPassword(confirmPasswordRevealBtn));
};

async function signUp(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (!emailInput || !displayNameInput || !usernameInput || !passwordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!isValidSignUpDetails()) {
    popup('Invalid sign up details.', 'error');
    LoadingModal.remove();

    return;
  };

  const accountSignUpBody: AccountSignUpBody = {
    email: emailInput.value,
    displayName: displayNameInput.value,
    username: usernameInput.value,
    password: passwordInput.value,
  };

  try {
    const accountSignUpData: AxiosResponse<AccountSignUpData> = await accountSignUpService(accountSignUpBody);
    const { accountId, verificationExpiryTimestamp } = accountSignUpData.data.resData;

    signUpState.accountId = accountId;
    signUpState.verificationExpiryTimestamp = verificationExpiryTimestamp;

    Cookies.set('verificationAccountId', `${accountId}`, 20 * 60);
    Cookies.set('verificationExpiryTimestamp', `${verificationExpiryTimestamp}`, 20 * 60);

    signUpState.verificationEmailsSent = 1;
    switchToVerificationStage();

    popup('Account created.', 'success');
    LoadingModal.remove();

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

    if (status === 403 && errReason === 'signedIn') {
      handleSignedInUser();
      return;
    };

    const inputRecord: Record<string, HTMLInputElement | undefined> = {
      invalidEmail: emailInput,
      emailTaken: emailInput,
      invalidDisplayName: displayNameInput,
      invalidUsername: usernameInput,
      usernameTaken: usernameInput,
      invalidPassword: passwordInput,
      passwordEqualsUsername: passwordInput,
    };

    if (status === 409) {
      if (errReason === 'emailAndUsernameTaken') {
        ErrorSpan.display(emailInput, 'Email address is already taken.');
        ErrorSpan.display(usernameInput, 'Username is already taken.');

        return;
      };

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
      };
    };
  };
};

function isValidSignUpDetails(): boolean {
  if (!emailInput || !displayNameInput || !usernameInput || !passwordInput || !confirmPasswordInput) {
    return false;
  };

  const validationArray: boolean[] = [
    validateEmail(emailInput),
    validateDisplayName(displayNameInput),
    validateNewUsername(usernameInput),
    validateNewPassword(passwordInput),
    validateConfirmPassword(confirmPasswordInput, passwordInput),
  ];

  if (validationArray.includes(false)) {
    return false;
  };

  if (passwordInput.value === usernameInput.value) {
    ErrorSpan.display(passwordInput, `Your password can't be identical to your username.`);
    return false;
  };

  return true;
};

function setActiveValidation(): void {
  emailInput?.addEventListener('input', () => validateEmail(emailInput));
  displayNameInput?.addEventListener('input', () => validateDisplayName(displayNameInput));
  usernameInput?.addEventListener('input', () => validateNewUsername(usernameInput));

  passwordInput?.addEventListener('input', () => {
    validateNewPassword(passwordInput);
    confirmPasswordInput && validateConfirmPassword(confirmPasswordInput, passwordInput);
  });

  confirmPasswordInput?.addEventListener('input', () => {
    passwordInput && validateConfirmPassword(confirmPasswordInput, passwordInput);
  });
};

function updateSignInDurationPreferences(): void {
  signUpState.keepSignedIn = !signUpState.keepSignedIn;

  if (keepSignedInBtn?.classList.contains('checked')) {
    keepSignedInBtn.classList.remove('checked');
    return;
  };

  keepSignedInBtn?.classList.add('checked');
};

function detectSignedInUser(): void {
  const signedInAs: string | null = Cookies.get('signedInAs');

  if (!signedInAs) {
    return;
  };

  handleSignedInUser();
};

function handleSignedInUser(): void {
  const signedInAs: string | null = Cookies.get('signedInAs');

  if (!signedInAs) {
    return;
  };

  const isGuestUser: boolean = signedInAs === 'guest';

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: `You're signed in.`,
    description: 'You must sign out before creating a new account.',
    confirmBtnTitle: isGuestUser ? 'Go to homepage' : 'Go to my account',
    cancelBtnTitle: 'Sign out',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      window.location.href = isGuestUser ? 'home' : 'account';
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      await signOut();
      ConfirmModal.remove();
    };
  });
};