import { signUpState } from "./signUpState";
import axios, { AxiosError, AxiosResponse } from "../../../../node_modules/axios/index";
import Cookies from "../global/Cookies";
import ErrorSpan from "../global/ErrorSpan";
import { InfoModal, InfoModalConfig } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { isValidUniqueCode, isValidQueryString, isValidTimestamp, validateCode } from "../global/validation";
import { AccountVerificationBody, AccountVerificationData, ResendVerificationEmailData, resendVerificationEmailService, verifyAccountService } from "../services/accountServices";
import { clearVerificationCookies, displayVerificationExpiryInfoModal, reloadWithoutQueryString, switchToVerificationStage } from "./signUpUtils";
import { ConfirmModal, ConfirmModalConfig } from "../global/ConfirmModal";
import { signOut } from "../global/signOut";


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
    signOut();

    await verifyAccount(new SubmitEvent('submit'));
    return;
  };

  setActiveValidation();
  detectOngoingVerification();
};

function loadEventListeners(): void {
  verificationFormElement?.addEventListener('submit', verifyAccount);
  resendVerificationCodeBtn?.addEventListener('slick', resendVerificationEmail);
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
    LoadingModal.remove();

    return;
  };

  const accountVerificationBody: AccountVerificationBody = {
    accountId: signUpState.accountId,
    verificationCode: verificationCodeInput.value.toUpperCase(),
  };

  try {
    const accountVerificationData: AxiosResponse<AccountVerificationData> = await verifyAccountService(accountVerificationBody);
    const { authToken } = accountVerificationData.data.resData;

    signUpState.verificationEmailsSent++;

    if (signUpState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, 14 * daySeconds);

    } else {
      Cookies.set('authToken', authToken);
    };

    clearVerificationCookies();

    popup('Account successfully verified.', 'success');
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

    if (status === 400 && errReason === 'accountId') {
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
          description: 'Your account has been automatically deleted as a result.\nYou can create it again by repeating the signup process.',
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

  if (signUpState.verificationEmailsSent >= 3) {
    popup('Verification email limit reached.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!signUpState.accountId || !signUpState.verificationStartTimestamp) {
    popup('Something went wrong.', 'error');
    clearVerificationCookies();
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  const verificationPeriod: number = 1000 * 60 * 15;
  if (Date.now() > verificationPeriod + signUpState.verificationStartTimestamp) {
    popup('Verification request expired.', 'error');
    clearVerificationCookies();
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  try {
    const resendVerificationEmailData: AxiosResponse<ResendVerificationEmailData> = await resendVerificationEmailService({ accountId: signUpState.accountId });
    const { verificationEmailsSent } = resendVerificationEmailData.data.resData;

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

    if (status === 400) {
      if (errReason === 'accountId') {
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
      signUpState.verificationEmailsSent = 3;
    };
  };
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
    const infoModalConfig: InfoModalConfig = {
      title: 'Invalid verification link.',
      description: 'Please ensure your click the correct link in your verification email.',
      btnTitle: 'okay',
    };

    const infoModal: HTMLDivElement = InfoModal.display(infoModalConfig);
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

  const { verificationAccountId, verificationStartTimestamp, verificationCode } = verificationData;

  const verificationPeriod: number = 1000 * 60 * 15;
  if (Date.now() - +verificationStartTimestamp > verificationPeriod) {
    displayVerificationExpiryInfoModal();
    return false;
  };

  Cookies.set('verificationAccountId', verificationAccountId);
  Cookies.set('verificationStartTimestamp', verificationStartTimestamp);

  signUpState.accountId = +verificationAccountId;
  signUpState.verificationStartTimestamp = +verificationStartTimestamp;

  switchToVerificationStage();
  verificationCodeInput ? verificationCodeInput.value = verificationCode : undefined;

  return true;
};

interface VerificationData {
  verificationAccountId: string,
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

  const verificationAccountId: string | undefined = queryMap.get('id');
  const verificationStartTimestamp: string | undefined = queryMap.get('requestTimestamp');
  const verificationCode: string | undefined = queryMap.get('verificationCode');

  if (!verificationAccountId || !verificationStartTimestamp || !verificationCode) {
    return null;
  };

  if (!Number.isInteger(+verificationAccountId)) {
    return null;
  };

  if (!isValidTimestamp(+verificationStartTimestamp)) {
    return null;
  };

  if (!isValidUniqueCode(verificationCode)) {
    return null;
  };

  const verificationData: VerificationData = {
    verificationAccountId,
    verificationStartTimestamp,
    verificationCode,
  };

  return verificationData;
};

function detectOngoingVerification(): void {
  if (invalidVerificationLinkPresent()) {
    return;
  };

  const existingAccountId: string | null = Cookies.get('verificationAccountId');
  const existingVerificationStartTimestamp: string | null = Cookies.get('verificationStartTimestamp');

  if (!existingAccountId || !existingVerificationStartTimestamp) {
    clearVerificationCookies();
    return;
  };

  if (+existingAccountId === 0 || !Number.isInteger(+existingAccountId)) {
    clearVerificationCookies();
    return;
  };

  if (!isValidTimestamp(+existingVerificationStartTimestamp)) {
    clearVerificationCookies();
    return;
  };

  const accountId: number = +existingAccountId;
  const verificationStartTimestamp: number = +existingVerificationStartTimestamp;

  const verificationPeriod: number = 1000 * 60 * 15;
  if (Date.now() - verificationStartTimestamp >= verificationPeriod) {
    clearVerificationCookies();
    return;
  };

  const confirmModalConfig: ConfirmModalConfig = {
    title: 'Verification request detected.',
    description: 'There seems to be an ongoing verification request.\nWould you like to proceed with verifying your account?',
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
      signUpState.accountId = accountId;
      signUpState.verificationStartTimestamp = verificationStartTimestamp;

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

function invalidVerificationLinkPresent(): boolean {
  const queryString: string = window.location.search;

  if (queryString !== '') {
    return true;
  };

  return false;
};