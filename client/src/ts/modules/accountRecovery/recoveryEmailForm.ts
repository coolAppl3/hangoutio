import { RecoveryStage, recoveryState } from "./recoveryState";
import axios, { AxiosError, AxiosResponse } from "../../../../node_modules/axios/index";
import ErrorSpan from "../global/ErrorSpan";
import { InfoModal } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { isValidQueryString, isValidTimestamp, isValidUniqueToken, validateEmail } from "../global/validation";
import { SendRecoveryEmailData, startAccountRecoveryService } from "../services/accountServices";
import { signOut } from "../global/signOut";
import { ConfirmModal } from "../global/ConfirmModal";
import Cookies from "../global/Cookies";
import { handleRecoverySuspended, handleRecoveryExpired, getMinutesTillRecoveryExpiry, handleSignedInUser, initRecoveryTimers, updateDisplayedForm } from "./recoveryUtils";

const recoveryEmailFormElement: HTMLFormElement | null = document.querySelector('#recovery-email-form');
const recoveryEmailInput: HTMLInputElement | null = document.querySelector('#recovery-email-input');

export function recoveryEmailForm(): void {
  loadEventListeners();
  init();
};

async function init(): Promise<void> {
  setActiveValidation();

  if (recoveryLinkDetected()) {
    await signOut();
    updateDisplayedForm();

    return;
  };

  detectSignedInUser();
};

function loadEventListeners(): void {
  recoveryEmailFormElement?.addEventListener('submit', startAccountRecovery);
};

async function startAccountRecovery(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (recoveryState.currentStage !== RecoveryStage.emailForm) {
    LoadingModal.remove();
    return;
  };

  if (!recoveryEmailInput) {
    popup('Something went wrong', 'error');
    LoadingModal.remove();

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
    const sendRecoveryEmailData: AxiosResponse<SendRecoveryEmailData> = await startAccountRecoveryService({ email: recoveryState.recoveryEmail });
    const expiryTimestamp: number = sendRecoveryEmailData.data.resData.expiryTimestamp;

    recoveryState.expiryTimestamp = expiryTimestamp;
    recoveryState.currentStage = RecoveryStage.confirmationForm;

    document.dispatchEvent(new CustomEvent('recoveryStarted'));

    disableRecoveryEmailInput();
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
    const errResData: unknown = axiosError.response.data.resData;

    LoadingModal.remove();
    popup(errMessage, 'error');

    if (status === 404) {
      ErrorSpan.display(recoveryEmailInput, errMessage);
      return;
    };

    if (status === 403) {
      if (errReason === 'signedIn') {
        handleSignedInUser();
        return;
      };

      ErrorSpan.display(recoveryEmailInput, errMessage);

      if (typeof errResData === 'object' && errResData !== null) {
        if (!('expiryTimestamp' in errResData) || typeof errResData.expiryTimestamp !== 'number') {
          return;
        };

        if (errReason === 'ongoingRequest') {
          handleOngoingRequestDetected();
          return;
        };

        if (errReason === 'recoverySuspended') {
          handleRecoverySuspended(errResData.expiryTimestamp);
        };
      };

      return;
    };

    if (status === 400 && errReason === 'invalidEmail') {
      ErrorSpan.display(recoveryEmailInput, errMessage);
    };
  };
};

function handleOngoingRequestDetected(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Ongoing recovery request detected.',
    description: 'Please check your inbox for a recovery email and follow its instructions.',
    btnTitle: 'Go to homepage',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'home';
    };
  });
};

function setActiveValidation(): void {
  recoveryEmailInput?.addEventListener('input', () => validateEmail(recoveryEmailInput));
};

function recoveryLinkDetected(): boolean {
  const url: URL = new URL(window.location.href);

  if (url.search === '') {
    return false;
  };

  if (!isValidQueryString(url.search)) {
    handleInvalidRecoveryLink();
    return false;
  };

  const recoveryLinkDetails: RecoveryLinkDetails | null = getRecoveryLinkDetails(url);

  if (!recoveryLinkDetails) {
    handleInvalidRecoveryLink();
    return false;
  };

  const { recoveryAccountId, expiryTimestamp, recoveryToken } = recoveryLinkDetails;

  if (Date.now() >= expiryTimestamp) {
    handleRecoveryExpired();
    return false;
  };

  recoveryState.recoveryAccountId = recoveryAccountId;
  recoveryState.expiryTimestamp = expiryTimestamp;
  recoveryState.recoveryToken = recoveryToken;

  recoveryState.currentStage = RecoveryStage.updatePasswordForm;
  initRecoveryTimers();

  return true;
};

interface RecoveryLinkDetails {
  recoveryAccountId: number,
  expiryTimestamp: number,
  recoveryToken: string,
};

function getRecoveryLinkDetails(url: URL): RecoveryLinkDetails | null {

  const recoveryAccountId: string | null = url.searchParams.get('id');
  const expiryTimestamp: string | null = url.searchParams.get('expiryTimestamp');
  const recoveryToken: string | null = url.searchParams.get('recoveryToken');

  if (!recoveryAccountId || !expiryTimestamp || !recoveryToken) {
    return null;
  };

  if (!Number.isInteger(+recoveryAccountId)) {
    return null;
  };

  if (!isValidTimestamp(+expiryTimestamp)) {
    return null;
  };

  if (!isValidUniqueToken(recoveryToken)) {
    return null;
  };

  const recoveryLinkDetails: RecoveryLinkDetails = {
    recoveryAccountId: +recoveryAccountId,
    expiryTimestamp: +expiryTimestamp,
    recoveryToken: recoveryToken,
  };

  return recoveryLinkDetails;
};

function detectSignedInUser(): void {
  const signedInAs: string | null = Cookies.get('signedInAs');

  if (!signedInAs) {
    return;
  };

  const isGuestUser: boolean = signedInAs === 'guest';

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: `You're signed in.`,
    description: 'You must sign out before starting the account recovery process.',
    confirmBtnTitle: 'Sign out',
    cancelBtnTitle: isGuestUser ? 'Go to homepage' : 'Go to my account',
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
      window.location.href = isGuestUser ? 'home' : 'account';
    };
  });
};

function handleInvalidRecoveryLink(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Invalid recovery link.',
    description: `Please ensure your click the correct link in your recovery email.`,
    btnTitle: 'Okay'
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      const hrefWithoutQueryString: string = window.location.href.split('?')[0];
      window.location.replace(hrefWithoutQueryString);
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