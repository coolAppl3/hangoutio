import { RecoveryStage, recoveryState } from "./recoveryState";
import axios, { AxiosError, AxiosResponse } from "../../../../node_modules/axios/index";
import ErrorSpan from "../global/ErrorSpan";
import { InfoModal, InfoModalConfig } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { isValidAuthToken, isValidQueryString, isValidTimestamp, isValidUniqueToken, validateEmail } from "../global/validation";
import { SendRecoveryEmailData, sendRecoveryEmailService } from "../services/accountServices";
import { signOut } from "../global/signOut";
import { ConfirmModal, ConfirmModalConfig } from "../global/ConfirmModal";
import Cookies from "../global/Cookies";
import { displayFailureLimitReachedInfoModal, displayRecoveryExpiryInfoModal, getMinutesTillRecoveryExpiry, updateDisplayedForm } from "./recoveryUtils";

const recoveryEmailFormElement: HTMLFormElement | null = document.querySelector('#recovery-email-form');
const recoveryEmailInput: HTMLInputElement | null = document.querySelector('#recovery-email-input');

export function recoveryEmailForm(): void {
  loadEventListeners();
  init();
};

function init(): void {
  setActiveValidation();

  if (recoveryLinkDetected()) {
    signOut();
    updateDisplayedForm();

    return;
  };

  detectSignedInUser();
};

function loadEventListeners(): void {
  recoveryEmailFormElement?.addEventListener('submit', sendRecoveryEmail);
};

async function sendRecoveryEmail(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (recoveryState.currentStage !== RecoveryStage.emailForm) {
    LoadingModal.remove();
    return;
  };

  if (!recoveryEmailInput) {
    LoadingModal.remove();
    popup('Something went wrong', 'error');

    return;
  };

  const isValidEmail: boolean = validateEmail(recoveryEmailInput);
  if (!isValidEmail) {
    LoadingModal.remove();
    ErrorSpan.display(recoveryEmailInput, 'Invalid email address.');
    popup('Invalid email address.', 'error');

    return;
  };

  recoveryState.recoveryEmail = recoveryEmailInput.value;

  try {
    const sendRecoveryEmailData: AxiosResponse<SendRecoveryEmailData> = await sendRecoveryEmailService({ email: recoveryState.recoveryEmail });
    const { requestTimestamp } = sendRecoveryEmailData.data.resData;

    recoveryState.recoveryStartTimestamp = requestTimestamp;
    recoveryState.currentStage = RecoveryStage.confirmationForm;

    disableRecoveryEmailInput();
    document.dispatchEvent(new CustomEvent('recoveryStarted'));
    updateDisplayedForm();

    popup('Recovery email sent.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    recoveryState.recoveryEmail = null;

    if (!axios.isAxiosError(err)) {
      LoadingModal.remove();
      popup('Something went wrong.', 'error');

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      LoadingModal.remove();
      popup('Something went wrong.', 'error');

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;
    const errResData: { [key: string]: unknown } | undefined = axiosError.response.data.resData;

    LoadingModal.remove();
    popup(errMessage, 'error');

    if (status === 400 && errReason === 'email') {
      ErrorSpan.display(recoveryEmailInput, errMessage);
      return;
    };

    if (status === 404) {
      ErrorSpan.display(recoveryEmailInput, errMessage);
      return;
    };

    if (status === 403) {
      ErrorSpan.display(recoveryEmailInput, errMessage);

      if (errResData && 'requestTimestamp' in errResData && typeof errResData.requestTimestamp === 'number') {
        if (errReason === 'emailLimitReached') {
          displayEmailLimitReachedInfoModal(errMessage, errResData.requestTimestamp);
          return;
        };

        if (errReason === 'failureLimitReached') {
          displayFailureLimitReachedInfoModal(errMessage, errResData.requestTimestamp);
        };
      };
    };
  };
};

function displayEmailLimitReachedInfoModal(errMessage: string, requestTimestamp: number): void {
  const minutesTillRecoveryExpiry: number = getMinutesTillRecoveryExpiry(requestTimestamp);
  const infoModalConfig: InfoModalConfig = {
    title: errMessage,
    description: `Make sure to check your spam and junk folders for the recovery email. \n If you still can't find it, you can start the recovery process again in ${minutesTillRecoveryExpiry === 1 ? '1 minute' : `${minutesTillRecoveryExpiry} minutes`}.`,
    btnTitle: 'Okay',
  };

  InfoModal.display(infoModalConfig, { simple: true });
};

function setActiveValidation(): void {
  recoveryEmailInput?.addEventListener('input', () => validateEmail(recoveryEmailInput));
};

function recoveryLinkDetected(): boolean {
  const queryString: string = window.location.search;

  if (queryString === '') {
    return false;
  };

  if (!isValidQueryString(queryString)) {
    displayInvalidRecoveryLinkModal();
    return false;
  };

  const recoveryLinkDetails: RecoveryLinkDetails | null = getRecoveryLinkDetails(queryString);
  if (!recoveryLinkDetails) {
    displayInvalidRecoveryLinkModal();
    return false;
  };

  const { recoveryAccountID, recoveryStartTimestamp, recoveryToken } = recoveryLinkDetails;

  const recoveryPeriod: number = 1000 * 60 * 60;
  if (Date.now() - recoveryStartTimestamp >= recoveryPeriod) {
    displayRecoveryExpiryInfoModal();
    return false;
  };

  recoveryState.recoveryAccountID = recoveryAccountID;
  recoveryState.recoveryStartTimestamp = recoveryStartTimestamp;
  recoveryState.recoveryToken = recoveryToken;

  recoveryState.currentStage = RecoveryStage.updatePasswordForm;

  return true;
};

interface RecoveryLinkDetails {
  recoveryAccountID: number,
  recoveryStartTimestamp: number,
  recoveryToken: string,
};

function getRecoveryLinkDetails(queryString: string): RecoveryLinkDetails | null {
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

  const recoveryAccountID: string | undefined = queryMap.get('id');
  const recoveryStartTimestamp: string | undefined = queryMap.get('timestamp');
  const recoveryToken: string | undefined = queryMap.get('recoveryToken');

  if (!recoveryAccountID || !recoveryStartTimestamp || !recoveryToken) {
    return null;
  };

  if (!Number.isInteger(+recoveryAccountID)) {
    return null;
  };

  if (!isValidTimestamp(+recoveryStartTimestamp)) {
    return null;
  };

  if (!isValidUniqueToken(recoveryToken)) {
    return null;
  };

  const recoveryLinkDetails: RecoveryLinkDetails = {
    recoveryAccountID: +recoveryAccountID,
    recoveryStartTimestamp: +recoveryStartTimestamp,
    recoveryToken: recoveryToken,
  };

  return recoveryLinkDetails;
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
    description: 'You must sign out before being able to start the account recovery process.',
    confirmBtnTitle: 'Sign out',
    cancelBtnTitle: 'Take me to my account',
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
      ConfirmModal.remove();

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'account.html';
    };
  });
};

function displayInvalidRecoveryLinkModal(): void {
  const infoModalConfig: InfoModalConfig = {
    title: 'Invalid recovery link.',
    description: `Please ensure your click the correct link in your recovery email.`,
    btnTitle: 'Okay'
  };

  const infoModal: HTMLDivElement = InfoModal.display(infoModalConfig);
  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'account-recovery.html';
    };
  });
};

function disableRecoveryEmailInput(): void {
  if (!recoveryEmailInput) {
    return;
  };

  recoveryEmailInput.parentElement?.classList.add('disabled');
  recoveryEmailInput.setAttribute('disabled', 'disabled');
};