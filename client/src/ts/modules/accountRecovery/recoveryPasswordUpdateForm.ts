import { RecoveryStage, recoveryState } from "./recoveryState";
import LoadingModal from "../global/LoadingModal";
import { validateConfirmPassword, validateNewPassword } from "../global/validation";
import { displayFailureLimitReachedInfoModal, getMinutesTillRecoveryExpiry, handleUserSignedIn, reloadWithoutQueryString, } from "./recoveryUtils";
import revealPassword from "../global/revealPassword";
import popup from "../global/popup";
import axios, { AxiosError, AxiosResponse } from "../../../../node_modules/axios/index";
import ErrorSpan from "../global/ErrorSpan";
import { InfoModal } from "../global/InfoModal";
import { RecoveryUpdatePasswordBody, RecoveryUpdatePasswordData, recoveryUpdatePasswordService } from "../services/accountServices";

const passwordUpdateFormElement: HTMLFormElement | null = document.querySelector('#password-update-form');

const newPasswordInput: HTMLInputElement | null = document.querySelector('#new-password-input');
const confirmNewPasswordInput: HTMLInputElement | null = document.querySelector('#confirm-new-password-input');

const newPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#new-password-input-reveal-btn');
const confirmNewPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#confirm-new-password-input-reveal-btn');

export function recoveryPasswordUpdateForm(): void {
  loadEventListeners();
  init();
};

function init(): void {
  setActiveValidation();
};

function loadEventListeners(): void {
  passwordUpdateFormElement?.addEventListener('submit', updateAccountPassword);

  newPasswordRevealBtn?.addEventListener('click', () => revealPassword(newPasswordRevealBtn));
  confirmNewPasswordRevealBtn?.addEventListener('click', () => revealPassword(confirmNewPasswordRevealBtn));
};

async function updateAccountPassword(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (recoveryState.currentStage !== RecoveryStage.updatePasswordForm) {
    LoadingModal.remove();
    return;
  };

  if (!recoveryState.recoveryAccountId || !recoveryState.expiryTimestamp || !recoveryState.recoveryToken) {
    popup('Something went wrong.', 'error');
    setTimeout(() => reloadWithoutQueryString(), 1000);

    return;
  };

  if (!newPasswordInput || !confirmNewPasswordInput) {
    popup('Something went wrong.', 'error');
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  const isValidNewPassword: boolean = validateNewPassword(newPasswordInput);
  if (!isValidNewPassword) {
    popup('Invalid new password.', 'error');
    LoadingModal.remove();

    return;
  };

  const recoveryUpdatePasswordBody: RecoveryUpdatePasswordBody = {
    accountId: recoveryState.recoveryAccountId,
    recoveryToken: recoveryState.recoveryToken,
    newPassword: newPasswordInput.value,
  };

  try {
    const recoveryUpdatePasswordData: AxiosResponse<RecoveryUpdatePasswordData> = await recoveryUpdatePasswordService(recoveryUpdatePasswordBody);
    const authSessionCreated: boolean = recoveryUpdatePasswordData.data.resData.authSessionCreated;

    popup('Account recovery successful.', 'success');

    const redirectHref: string = authSessionCreated ? 'account' : 'sign-in'
    setTimeout(() => window.location.replace(redirectHref), 1000);

  } catch (err: unknown) {
    console.log(err);

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
    popup(errMessage, 'error')

    if (status === 409) {
      ErrorSpan.display(newPasswordInput, errMessage);
      return;
    };

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => reloadWithoutQueryString(), 1000);

      return;
    };

    if (status === 403) {
      if (errReason === 'signedIn') {
        handleUserSignedIn();
        return;
      };

      if (typeof errResData !== 'object' || errResData === null) {
        return;
      };

      if (!('expiryTimestamp' in errResData) || typeof errResData.expiryTimestamp !== 'number') {
        return;
      };

      const expiryTimestamp: number = errResData.expiryTimestamp;
      recoveryState.expiryTimestamp = expiryTimestamp;

      displayFailureLimitReachedInfoModal(errMessage, recoveryState.expiryTimestamp);
      return;
    };

    if (status === 401) {
      if (errReason === 'recoverySuspended') {
        handleRecoverySuspension(errResData);
        return;
      };

      displayIncorrectRecoveryLinkDataInfoModal(errMessage);
      return;
    };

    if (status === 400) {
      if (errReason === 'password') {
        ErrorSpan.display(newPasswordInput, errMessage);
        return;
      };

      displayIncorrectRecoveryLinkDataInfoModal(errMessage);
    };
  };
};

function displayIncorrectRecoveryLinkDataInfoModal(errMessage: string): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: errMessage,
    description: 'Make sure to click the correct link in your recovery email.',
    btnTitle: 'Okay',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      reloadWithoutQueryString();
    };
  });
};


function setActiveValidation(): void {
  newPasswordInput?.addEventListener('input', () => {
    validateNewPassword(newPasswordInput);
    confirmNewPasswordInput ? validateConfirmPassword(confirmNewPasswordInput, newPasswordInput) : undefined;
  });

  confirmNewPasswordInput?.addEventListener('input', () => {
    newPasswordInput ? validateConfirmPassword(confirmNewPasswordInput, newPasswordInput) : undefined;
  });
};

function handleRecoverySuspension(errResData: unknown): void {
  if (typeof errResData !== 'object' || errResData === null) {
    return;
  };

  if (!('expiryTimestamp' in errResData) || typeof errResData.expiryTimestamp !== 'number') {
    return;
  };

  const minutesTillExpiry: number = getMinutesTillRecoveryExpiry(errResData.expiryTimestamp);
  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Recovery request suspended.',
    description: `Your recovery request has been suspended due to too many failed attempts.\nYou can start the process again in ${minutesTillExpiry === 1 ? '1 minute' : `${minutesTillExpiry} minutes`}.`,
    btnTitle: 'Okay',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      reloadWithoutQueryString();
    };
  });
};