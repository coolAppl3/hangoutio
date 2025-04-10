import { recoveryState } from "./recoveryState";
import axios, { AxiosError } from "../../../../node_modules/axios/index";
import ErrorSpan from "../global/ErrorSpan";
import { InfoModal } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { isValidQueryString, isValidTimestamp, isValidCode, validateEmail } from "../global/validation";
import { startAccountRecoveryService } from "../services/accountServices";
import { signOut } from "../global/signOut";
import { ConfirmModal } from "../global/ConfirmModal";
import Cookies from "../global/Cookies";
import { handleRecoveryExpired, handleSignedInUser, reloadWithoutQueryString, handleUnexpectedError, handleRecoverySuspension, progressRecovery } from "./recoveryUtils";
import { AsyncErrorData, getAsyncErrorData } from "../global/errorUtils";

const recoveryEmailFormElement: HTMLFormElement | null = document.querySelector('#recovery-email-form');
const recoveryEmailInput: HTMLInputElement | null = document.querySelector('#recovery-email-input');

export function recoveryEmailForm(): void {
  loadEventListeners();
  init();
};

async function init(isFirstCall: boolean = true): Promise<void> {
  if (isFirstCall) {
    setActiveValidation();
  };

  const isSignedIn: boolean = detectSignedInUser();
  if (isSignedIn) {
    return;
  };

  detectRecoveryLink();
};

function loadEventListeners(): void {
  recoveryEmailFormElement?.addEventListener('submit', startAccountRecovery);
};

async function startAccountRecovery(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (recoveryState.inPasswordUpdateStage) {
    LoadingModal.remove();
    return;
  };

  if (!recoveryEmailInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidEmail: boolean = validateEmail(recoveryEmailInput);
  if (!isValidEmail) {
    popup('Invalid email address.', 'error');
    LoadingModal.remove();

    ErrorSpan.display(recoveryEmailInput, 'Invalid email address.');
    return;
  };

  recoveryState.recoveryEmail = recoveryEmailInput.value;

  try {
    const { accountId, expiryTimestamp } = (await startAccountRecoveryService({ email: recoveryState.recoveryEmail })).data;

    recoveryState.accountId = accountId;
    recoveryState.expiryTimestamp = expiryTimestamp;

    popup('Recovery email sent.', 'success');
    LoadingModal.remove();

    progressRecovery();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason, errResData } = asyncErrorData;

    if (status === 409 && errReason === 'ongoingRequest') {
      if (typeof errResData !== 'object' || errResData === null) {
        handleUnexpectedError();
        return;
      };

      if (!('accountId' in errResData) || !('expiryTimestamp' in errResData)) {
        handleUnexpectedError();
        return;
      };

      if (typeof errResData.accountId !== 'number' || typeof errResData.expiryTimestamp !== 'number') {
        handleUnexpectedError();
        return;
      };

      recoveryState.accountId = errResData.accountId;
      recoveryState.expiryTimestamp = errResData.expiryTimestamp;

      popup(errMessage, 'success');
      progressRecovery();

      return;
    };

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

      if (errReason === 'recoverySuspended') {
        ErrorSpan.display(recoveryEmailInput, errMessage);
        handleRecoverySuspension(errResData);
      };

      return;
    };

    if (status === 400 && errReason === 'invalidEmail') {
      ErrorSpan.display(recoveryEmailInput, errMessage);
    };
  };
};

function setActiveValidation(): void {
  recoveryEmailInput?.addEventListener('input', () => validateEmail(recoveryEmailInput));
};

function detectSignedInUser(): boolean {
  const signedInAs: string | null = Cookies.get('signedInAs');

  if (!signedInAs) {
    return false;
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: `You're signed in.`,
    description: 'You must sign out before starting the account recovery process.',
    confirmBtnTitle: 'Sign out',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      await signOut();
      ConfirmModal.remove();

      await init(false);
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'home';
    };
  });

  return true;
};

function detectRecoveryLink(): void {
  const url: URL = new URL(window.location.href);

  if (url.search === '') {
    return;
  };

  if (!isValidQueryString(url.search)) {
    handleInvalidRecoveryLink();
    return;
  };

  const recoveryLinkDetails: RecoveryLinkDetails | null = getRecoveryLinkDetails(url);

  if (!recoveryLinkDetails) {
    handleInvalidRecoveryLink();
    return;
  };

  const { recoveryAccountId, expiryTimestamp, recoveryCode } = recoveryLinkDetails;

  if (Date.now() >= expiryTimestamp) {
    handleRecoveryExpired();
    return;
  };

  recoveryState.accountId = recoveryAccountId;
  recoveryState.expiryTimestamp = expiryTimestamp;

  progressRecovery(recoveryCode);
};

interface RecoveryLinkDetails {
  recoveryAccountId: number,
  expiryTimestamp: number,
  recoveryCode: string,
};

function getRecoveryLinkDetails(url: URL): RecoveryLinkDetails | null {
  const recoveryAccountId: string | null = url.searchParams.get('id');
  const expiryTimestamp: string | null = url.searchParams.get('expiryTimestamp');
  const recoveryCode: string | null = url.searchParams.get('recoveryCode');

  if (!recoveryAccountId || !expiryTimestamp || !recoveryCode) {
    return null;
  };

  if (!Number.isInteger(+recoveryAccountId)) {
    return null;
  };

  if (!isValidTimestamp(+expiryTimestamp)) {
    return null;
  };

  if (!isValidCode(recoveryCode)) {
    return null;
  };

  const recoveryLinkDetails: RecoveryLinkDetails = {
    recoveryAccountId: +recoveryAccountId,
    expiryTimestamp: +expiryTimestamp,
    recoveryCode: recoveryCode,
  };

  return recoveryLinkDetails;
};

function handleInvalidRecoveryLink(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Invalid recovery link.',
    description: `Please ensure your click the correct link in your recovery email.`,
    btnTitle: 'Okay'
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      reloadWithoutQueryString();
    };
  });
};