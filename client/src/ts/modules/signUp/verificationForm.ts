import { signUpState } from "./signUpState";
import axios, { AxiosError } from "../../../../node_modules/axios/index";
import Cookies from "../global/Cookies";
import ErrorSpan from "../global/ErrorSpan";
import { InfoModal } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { isValidCode, isValidQueryString, isValidTimestamp, validateCode, isValidHangoutId } from "../global/validation";
import { AccountVerificationBody, resendVerificationEmailService, verifyAccountService } from "../services/accountServices";
import { clearVerificationCookies, displayVerificationExpiryInfoModal, handleSignedInUser, reloadWithoutQueryString, switchToVerificationStage } from "./signUpUtils";
import { ConfirmModal } from "../global/ConfirmModal";
import { EMAILS_SENT_LIMIT } from "../global/clientConstants";


const verificationFormElement: HTMLFormElement | null = document.querySelector('#verification-form');
const verificationCodeInput: HTMLInputElement | null = document.querySelector('#verification-code-input');

const resendVerificationCodeBtn: HTMLButtonElement | null = document.querySelector('#resend-code-btn');


export function verificationForm(): void {
  loadEventListeners();
  init();
};

async function init(): Promise<void> {
  if (verificationLinkDetected()) {
    signUpState.inVerificationStage = true;

    await verifyAccount(new SubmitEvent('submit'));
    return;
  };

  setActiveValidation();
  detectOngoingVerification();
};

function loadEventListeners(): void {
  verificationFormElement?.addEventListener('submit', verifyAccount);
  resendVerificationCodeBtn?.addEventListener('click', resendVerificationEmail);
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

  if (!signUpState.accountId) {
    popup('Something went wrong.', 'error');
    clearVerificationCookies();
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  const accountVerificationBody: AccountVerificationBody = {
    accountId: signUpState.accountId,
    verificationCode: verificationCodeInput.value.toUpperCase(),
  };

  try {
    const authSessionCreated: boolean = (await verifyAccountService(accountVerificationBody)).data.authSessionCreated;

    clearVerificationCookies();
    popup('Account successfully verified.', 'success');

    if (!authSessionCreated) {
      setTimeout(() => window.location.replace('sign-in'), 1000);
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

    if (status === 400 && errReason === 'invalidAccountId') {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 403) {
      handleSignedInUser();
      return;
    };

    if (status === 404 || status === 409) {
      clearVerificationCookies();
      return;
    };

    if (status === 401) {
      ErrorSpan.display(verificationCodeInput, errMessage);

      if (errReason === 'accountDeleted') {
        clearVerificationCookies();

        const infoModal: HTMLDivElement = InfoModal.display({
          title: 'Too many failed verification attempts.',
          description: 'Your account has been deleted as a result.\nYou can create it again by repeating the signup process.',
          btnTitle: 'Okay',
        });

        infoModal.addEventListener('click', (e: MouseEvent) => {
          if (!(e.target instanceof HTMLElement)) {
            return;
          };

          if (e.target.id === 'info-modal-btn') {
            window.location.reload();
          };
        });
      };

      return;
    };

    if (status === 400 && errReason === 'verificationCode') {
      ErrorSpan.display(verificationCodeInput, errMessage);
    };
  };
};

async function resendVerificationEmail(): Promise<void> {
  LoadingModal.display();

  if (signUpState.verificationEmailsSent >= EMAILS_SENT_LIMIT) {
    popup('Verification email limit reached.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!signUpState.accountId || !signUpState.verificationExpiryTimestamp) {
    popup('Something went wrong.', 'error');
    clearVerificationCookies();
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  if (Date.now() >= signUpState.verificationExpiryTimestamp) {
    popup('Verification request expired.', 'error');
    clearVerificationCookies();
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  try {
    const verificationEmailsSent: number = (await resendVerificationEmailService({ accountId: signUpState.accountId })).data.verificationEmailsSent;

    signUpState.verificationEmailsSent = verificationEmailsSent;

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

    if (status === 400 && errReason === 'invalidAccountId') {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 404 || status === 409) {
      clearVerificationCookies();
      return;
    };

    if (status === 403 && errReason === 'emailLimitReached') {
      signUpState.verificationEmailsSent = 3;
    };
  };
};

function verificationLinkDetected(): boolean {
  const url: URL = new URL(window.location.href);

  if (url.search === '') {
    return false;
  };

  if (!isValidQueryString(url.search)) {
    return false;
  };

  const verificationData: VerificationData | null = getVerificationLinkDetails(url);

  if (!verificationData) {
    const infoModal: HTMLDivElement = InfoModal.display({
      title: 'Invalid verification link.',
      description: 'Please ensure your click the correct link in your verification email.',
      btnTitle: 'okay',
    });

    infoModal.addEventListener('click', (e: MouseEvent) => {
      if (!(e.target instanceof HTMLElement)) {
        return;
      };

      if (e.target.id === 'info-modal-btn') {
        reloadWithoutQueryString();
      };
    });

    return false;
  };

  const { verificationAccountId, verificationExpiryTimestamp, verificationCode } = verificationData;

  if (Date.now() >= +verificationExpiryTimestamp) {
    displayVerificationExpiryInfoModal();
    return false;
  };

  Cookies.set('verificationAccountId', verificationAccountId);
  Cookies.set('verificationExpiryTimestamp', verificationExpiryTimestamp);

  signUpState.accountId = +verificationAccountId;
  signUpState.verificationExpiryTimestamp = +verificationExpiryTimestamp;

  switchToVerificationStage();
  verificationCodeInput && (verificationCodeInput.value = verificationCode);

  return true;
};

interface VerificationData {
  verificationAccountId: string,
  verificationExpiryTimestamp: string,
  verificationCode: string,
};

function getVerificationLinkDetails(url: URL): VerificationData | null {
  const verificationAccountId: string | null = url.searchParams.get('id');
  const verificationExpiryTimestamp: string | null = url.searchParams.get('expiryTimestamp');
  const verificationCode: string | null = url.searchParams.get('verificationCode');

  if (!verificationAccountId || !verificationExpiryTimestamp || !verificationCode) {
    return null;
  };

  if (!Number.isInteger(+verificationAccountId)) {
    return null;
  };

  if (!isValidTimestamp(+verificationExpiryTimestamp)) {
    return null;
  };

  if (!isValidCode(verificationCode)) {
    return null;
  };

  const verificationData: VerificationData = {
    verificationAccountId,
    verificationExpiryTimestamp,
    verificationCode,
  };

  return verificationData;
};

function detectOngoingVerification(): void {
  if (window.location.search !== '') {
    return;
  };

  const existingAccountId: string | null = Cookies.get('verificationAccountId');
  const existingVerificationExpiryTimestamp: string | null = Cookies.get('verificationExpiryTimestamp');

  if (!existingAccountId || !existingVerificationExpiryTimestamp) {
    clearVerificationCookies();
    return;
  };

  if (+existingAccountId === 0 || !Number.isInteger(+existingAccountId)) {
    clearVerificationCookies();
    return;
  };

  if (!isValidTimestamp(+existingVerificationExpiryTimestamp)) {
    clearVerificationCookies();
    return;
  };

  const accountId: number = +existingAccountId;
  const verificationExpiryTimestamp: number = +existingVerificationExpiryTimestamp;

  if (Date.now() >= verificationExpiryTimestamp) {
    clearVerificationCookies();
    return;
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Verification request detected.',
    description: 'There seems to be an ongoing verification request.\nWould you like to proceed with verifying your account?',
    confirmBtnTitle: 'Proceed',
    cancelBtnTitle: 'Remove request',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      signUpState.accountId = accountId;
      signUpState.verificationExpiryTimestamp = verificationExpiryTimestamp;

      switchToVerificationStage();
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

function setActiveValidation(): void {
  verificationCodeInput?.addEventListener('input', () => validateCode(verificationCodeInput));
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
    description: `You've attempted to join a hangout earlier.\nWould you like to try again now that you're signed in?`,
    confirmBtnTitle: 'Join hangout',
    cancelBtnTitle: 'Go to my account',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      window.location.replace(`hangout?id=${hangoutId}`);
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      Cookies.remove('pendingSignInHangoutId');
      window.location.replace('account');
    };
  });
};