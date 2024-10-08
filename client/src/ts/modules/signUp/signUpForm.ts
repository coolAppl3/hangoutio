import axios, { AxiosError } from "../../../../node_modules/axios/index";
import { ConfirmModal, ConfirmModalConfig } from "../global/ConfirmModal";
import Cookies from "../global/Cookies";
import ErrorSpan from "../global/ErrorSpan";
import { InfoModal, InfoModalConfig } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import revealPassword from "../global/revealPassword";
import { signOut } from "../global/signOut";
import { isValidAuthToken, isValidCode, isValidQueryString, isValidTimestamp, validateCode, validateConfirmPassword, validateDisplayName, validateEmail, validateNewPassword, validateNewUsername } from "../global/validation";
import { AccountSignUpBody, AccountSignUpData, accountSignUpService, AccountVerificationBody, AccountVerificationData, resendVerificationEmailService, verifyAccountService } from "../services/accountServices";

interface SignUpFormState {
  keepSignedIn: boolean,
  accountID: number | null,
  verificationStartTimestamp: number | null,
  verificationEmailsSent: number,
};

const signUpFormState: SignUpFormState = {
  keepSignedIn: false,
  accountID: null,
  verificationStartTimestamp: null,
  verificationEmailsSent: 0,
};

const signUpSection: HTMLDivElement | null = document.querySelector('#sign-up-section');
const signUpFormElement: HTMLFormElement | null = document.querySelector('#sign-up-form');

const emailInput: HTMLInputElement | null = document.querySelector('#email-input');
const displayNameInput: HTMLInputElement | null = document.querySelector('#display-name-input');
const usernameInput: HTMLInputElement | null = document.querySelector('#username-input');
const passwordInput: HTMLInputElement | null = document.querySelector('#password-input');
const confirmPasswordInput: HTMLInputElement | null = document.querySelector('#confirm-password-input');

const passwordRevealBtn: HTMLButtonElement | null = document.querySelector('#password-input-reveal-btn');
const confirmPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#confirm-password-input-reveal-btn');
const keepSignedInBtn: HTMLButtonElement | null = document.querySelector('#keep-signed-in-btn');
const resendCodeBtn: HTMLButtonElement | null = document.querySelector('#resend-code-btn');

const verificationForm: HTMLFormElement | null = document.querySelector('#verification-form');
const verificationCodeInput: HTMLInputElement | null = document.querySelector('#verification-code-input');

export function signUpForm(): void {
  loadEventListeners();
  init();
};

async function init(): Promise<void> {
  setActiveValidation();

  if (verificationLinkDetected()) {
    signOut();
    await verifyAccount(new SubmitEvent('submit'));

    return;
  };

  detectSignedInUser();
  detectOngoingVerification();
};

function loadEventListeners(): void {
  signUpFormElement?.addEventListener('submit', signUp);
  verificationForm?.addEventListener('submit', verifyAccount);
  keepSignedInBtn?.addEventListener('click', updateSignInDurationPreferences);
  resendCodeBtn?.addEventListener('click', resendVerificationEmail);

  passwordRevealBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    revealPassword(passwordRevealBtn);
  });

  confirmPasswordRevealBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    revealPassword(confirmPasswordRevealBtn);
  });
};

async function signUp(e: SubmitEvent, attemptCount: number = 1): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (attemptCount > 2) {
    popup('Internal server error.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!isValidSignUpDetails()) {
    popup('Invalid sign up details.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!emailInput || !displayNameInput || !usernameInput || !passwordInput) {
    popup('Something went wrong.', 'error');
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
    const accountSignUpData: AccountSignUpData = await accountSignUpService(accountSignUpBody);
    const { accountID, createdOnTimestamp } = accountSignUpData.data.resData;

    signUpFormState.accountID = accountID;
    signUpFormState.verificationStartTimestamp = createdOnTimestamp;

    Cookies.set('verificationAccountID', `${accountID}`);
    Cookies.set('verificationStartTimestamp', `${createdOnTimestamp}`);

    switchToVerificationStep();

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

    if (status === 409 && errReason === 'duplicateAuthToken') {
      signUp(new SubmitEvent('submit'), ++attemptCount);
      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 400) {
      if (errReason === 'email') {
        ErrorSpan.display(emailInput, errMessage);
        return;
      };

      if (errReason === 'displayName') {
        ErrorSpan.display(displayNameInput, errMessage);
        return;
      };

      if (errReason === 'username') {
        ErrorSpan.display(usernameInput, errMessage);
        return;
      };

      if (errReason === 'password') {
        ErrorSpan.display(passwordInput, errMessage);
        return;
      };

      return;
    };

    if (status === 409) {
      if (errReason === 'emailAndUsernameTaken') {
        ErrorSpan.display(emailInput, 'Email address is already taken.');
        ErrorSpan.display(usernameInput, 'Username is already taken.');

        return;
      };

      if (errReason === 'emailTaken') {
        ErrorSpan.display(emailInput, errMessage);
        return;
      };

      if (errReason === 'usernameTaken') {
        ErrorSpan.display(usernameInput, errMessage);
        return;
      };
    };
  };
};

async function verifyAccount(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (!verificationCodeInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidVerificationCode: boolean = validateCode(verificationCodeInput);
  if (!isValidVerificationCode) {
    popup('Invalid verification code.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!signUpFormState.accountID) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const accountVerificationBody: AccountVerificationBody = {
    accountID: signUpFormState.accountID,
    verificationCode: verificationCodeInput.value.toUpperCase(),
  };

  try {
    const accountVerificationData: AccountVerificationData = await verifyAccountService(accountVerificationBody);
    const { authToken } = accountVerificationData.data.resData;

    signUpFormState.verificationEmailsSent++;

    if (signUpFormState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, 14 * daySeconds);

    } else {
      Cookies.set('authToken', authToken);
    };

    clearVerificationCookies();

    popup('Account successfully verified.', 'success');
    setTimeout(() => window.location.href = 'account.html', 1000);

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

    if (status === 400 && errReason === 'accountID') {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 400 && errReason === 'verificationCode') {
      ErrorSpan.display(verificationCodeInput, errMessage);
      return;
    };

    if (status === 401) {
      ErrorSpan.display(verificationCodeInput, errMessage);

      if (errReason === 'accountDeleted') {
        const infoModalConfig: InfoModalConfig = {
          title: 'Too many failed verification attempts.',
          description: 'Your account has been automatically deleted as a result. \n You can create it again by repeating the signup process.',
          btnTitle: 'Okay',
        };

        const infoModal: HTMLDivElement = InfoModal.display(infoModalConfig);
        infoModal.addEventListener('click', (e: MouseEvent) => {
          if (!(e.target instanceof HTMLElement)) {
            return;
          };

          if (e.target.id === 'info-modal-btn') {
            clearVerificationCookies();
            window.location.reload();
          };
        });
      };
    };
  };
};

async function resendVerificationEmail(): Promise<void> {
  LoadingModal.display();

  if (signUpFormState.verificationEmailsSent >= 3) {
    popup('Verification email limit reached.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!signUpFormState.accountID || !signUpFormState.verificationStartTimestamp) {
    popup('Something went wrong.', 'error');
    clearVerificationCookies();
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  const verificationPeriod: number = 1000 * 60 * 15;
  if (Date.now() > verificationPeriod + signUpFormState.verificationStartTimestamp) {
    popup('Verification request expired.', 'error');
    clearVerificationCookies();
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  try {
    await resendVerificationEmailService({ accountID: signUpFormState.accountID });

    popup('Verification email resent.', 'success');
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

    if (status === 400) {
      if (errReason === 'accountID') {
        popup(errMessage, 'error');
        setTimeout(() => window.location.reload(), 1000);

        return;
      };

      if (errReason === 'alreadyVerified') {
        popup(errMessage, 'error');
        setTimeout(() => window.location.href = 'sign-in.html', 1000);

        return;
      };
    };

    if (status === 404) {
      popup(errMessage, 'error');
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 403 && errReason === 'limitReached') {
      signUpFormState.verificationEmailsSent = 3;
    };
  };
};

function isValidSignUpDetails(): boolean {
  if (!emailInput || !displayNameInput || !usernameInput || !passwordInput || !confirmPasswordInput) {
    return false;
  };

  const validationArray: boolean[] = [];

  validationArray.push(validateEmail(emailInput));
  validationArray.push(validateDisplayName(displayNameInput));
  validationArray.push(validateNewUsername(usernameInput));
  validationArray.push(validateNewPassword(passwordInput));
  validationArray.push(validateConfirmPassword(confirmPasswordInput, passwordInput));

  if (validationArray.includes(false)) {
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
    confirmPasswordInput ? validateConfirmPassword(confirmPasswordInput, passwordInput) : undefined;
  });

  confirmPasswordInput?.addEventListener('input', () => {
    passwordInput ? validateConfirmPassword(confirmPasswordInput, passwordInput) : undefined;
  });

  verificationCodeInput?.addEventListener('input', () => validateCode(verificationCodeInput));
};

function updateSignInDurationPreferences(e: MouseEvent): void {
  e.preventDefault();
  signUpFormState.keepSignedIn = !signUpFormState.keepSignedIn;

  if (keepSignedInBtn?.classList.contains('checked')) {
    keepSignedInBtn.classList.remove('checked');
    return;
  };

  keepSignedInBtn?.classList.add('checked');
};

function switchToVerificationStep(): void {
  signUpSection?.classList.add('verification-step');
  verificationCodeInput ? verificationCodeInput.value = '' : undefined;

  initVerificationTimer();
};

function initVerificationTimer(): void {
  const requestExpiryTimer: HTMLSpanElement | null = document.querySelector('#request-expiry-timer');

  if (!requestExpiryTimer || !signUpFormState.verificationStartTimestamp) {
    return;
  };

  requestExpiryTimer?.classList.add('displayed');

  const verificationPeriod: number = 1000 * 60 * 15;
  const requestExpiryTimestamp: number = signUpFormState.verificationStartTimestamp + verificationPeriod;

  const timerInterval: number = setInterval(() => updateVerificationTimer(timerInterval, requestExpiryTimer, requestExpiryTimestamp), 1000);
  updateVerificationTimer(timerInterval, requestExpiryTimer, requestExpiryTimestamp);
};

function updateVerificationTimer(intervalID: number, requestExpiryTimer: HTMLSpanElement, requestExpiryTimestamp: number): void {
  if (Date.now() >= requestExpiryTimestamp) {
    clearInterval(intervalID);
    clearVerificationCookies();
    displayVerificationExpiryInfoModal();

    return;
  };

  const timeTillExpiry: number = requestExpiryTimestamp - Date.now();

  if (timeTillExpiry < 0) {
    requestExpiryTimer.textContent = '00:00';
    return;
  };

  const minutesTillExpiry: number = Math.floor(timeTillExpiry / (1000 * 60));
  const secondsTillExpiry: number = Math.round((timeTillExpiry / 1000) % 60);

  const minutesTillExpiryString: string = minutesTillExpiry < 10 ? `0${minutesTillExpiry}` : `${minutesTillExpiry}`;
  const secondsTillExpiryString: string = secondsTillExpiry < 10 ? `0${secondsTillExpiry}` : `${secondsTillExpiry}`;

  requestExpiryTimer.textContent = `${minutesTillExpiryString}:${secondsTillExpiryString}`;
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

  const confirmModalConfig: ConfirmModalConfig = {
    title: `You're signed in.`,
    description: 'You must sign out before being able to create a new account.',
    confirmBtnTitle: 'Sign out',
    cancelBtnTitle: 'Take me back to my account',
    extraBtnTitle: null,
    isDangerousAction: false,
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display(confirmModalConfig);
  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      signOut();
      popup('Signed out.', 'success');
      ConfirmModal.remove();

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'account.html';
    };
  });
};

function detectOngoingVerification(): void {
  const existingAccountID: string | null = Cookies.get('verificationAccountID');
  const existingVerificationStartTimestamp: string | null = Cookies.get('verificationStartTimestamp');

  if (!existingAccountID || !existingVerificationStartTimestamp) {
    clearVerificationCookies();
    return;
  };

  if (+existingAccountID === 0 || !Number.isInteger(+existingAccountID)) {
    clearVerificationCookies();
    return;
  };

  if (!isValidTimestamp(+existingVerificationStartTimestamp)) {
    clearVerificationCookies();
    return;
  };

  const accountID: number = +existingAccountID;
  const verificationStartTimestamp: number = +existingVerificationStartTimestamp;

  const verificationPeriod: number = 1000 * 60 * 15;
  if (Date.now() - verificationStartTimestamp >= verificationPeriod) {
    clearVerificationCookies();
    return;
  };

  const confirmModalConfig: ConfirmModalConfig = {
    title: 'Verification request detected.',
    description: 'There seems to be an ongoing verification request. \n Would you like to proceed with verifying your account?',
    confirmBtnTitle: 'Proceed',
    cancelBtnTitle: 'Remove request',
    extraBtnTitle: null,
    isDangerousAction: false,
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display(confirmModalConfig);
  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      signUpFormState.accountID = accountID;
      signUpFormState.verificationStartTimestamp = verificationStartTimestamp;

      switchToVerificationStep();
      ConfirmModal.remove();

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      clearVerificationCookies();
      ConfirmModal.remove();
      popup('Verification request removed.', 'success');
    };
  });
};

function verificationLinkDetected(): boolean {
  const queryString: string = window.location.search;

  if (queryString === '') {
    return false;
  };

  if (!isValidQueryString(queryString)) {
    return false;
  };

  const verificationData: VerificationData | null = getVerificationLinkDetails(queryString);
  if (!verificationData) {
    LoadingModal.display();
    popup('Invalid verification link.', 'error');
    setTimeout(() => reloadWithoutQueryString(), 1000);

    return false;
  };

  const { verificationAccountID, verificationStartTimestamp, verificationCode } = verificationData;

  const verificationPeriod: number = 1000 * 60 * 15;
  if (Date.now() - +verificationStartTimestamp > verificationPeriod) {
    displayVerificationExpiryInfoModal();
    return false;
  };

  Cookies.set('verificationAccountID', verificationAccountID);
  Cookies.set('verificationStartTimestamp', verificationStartTimestamp);

  signUpFormState.accountID = +verificationAccountID;
  signUpFormState.verificationStartTimestamp = +verificationStartTimestamp;

  switchToVerificationStep();
  verificationCodeInput ? verificationCodeInput.value = verificationCode : undefined;

  return true;
};

interface VerificationData {
  verificationAccountID: string,
  verificationStartTimestamp: string,
  verificationCode: string,
};

function getVerificationLinkDetails(queryString: string): VerificationData | null {
  const queryParams: string[] = queryString.substring(1).split('&');
  const queryMap: Map<string, string> = new Map();

  if (queryParams.length !== 3) {
    return null;
  };

  for (const param of queryParams) {
    const keyValuePair: string[] = param.split('=');

    if (keyValuePair.length !== 2) {
      return null;
    };

    if (keyValuePair[0] === '' || keyValuePair[1] === '') {
      return null;
    };

    queryMap.set(keyValuePair[0], keyValuePair[1]);
  };

  const verificationAccountID: string | undefined = queryMap.get('id');
  const verificationStartTimestamp: string | undefined = queryMap.get('timestamp');
  const verificationCode: string | undefined = queryMap.get('verificationCode');

  if (!verificationAccountID || !verificationStartTimestamp || !verificationCode) {
    return null;
  };

  if (!Number.isInteger(+verificationAccountID)) {
    return null;
  };

  if (!isValidTimestamp(+verificationStartTimestamp)) {
    return null;
  };

  if (!isValidCode(verificationCode)) {
    return null;
  };

  const verificationData: VerificationData = {
    verificationAccountID,
    verificationStartTimestamp,
    verificationCode,
  };

  return verificationData;
};

function displayVerificationExpiryInfoModal(): void {
  const infoModalConfig: InfoModalConfig = {
    title: 'Verification request expired.',
    description: 'Your account has been deleted, but you can create it again and verify it within 15 minutes.',
    btnTitle: 'Okay',
  };

  const infoModal: HTMLDivElement = InfoModal.display(infoModalConfig);
  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      clearVerificationCookies();
      reloadWithoutQueryString();
      return;
    };
  });
};

function clearVerificationCookies(): void {
  Cookies.remove('verificationAccountID');
  Cookies.remove('verificationStartTimestamp');
};

function reloadWithoutQueryString(): void {
  const hrefWithoutQueryString: string = window.location.href.split('?')[0];
  window.location.href = hrefWithoutQueryString;
};