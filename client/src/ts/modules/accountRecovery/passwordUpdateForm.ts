import { RecoveryStage, recoveryState } from "./recoveryState";
import LoadingModal from "../global/LoadingModal";
import { validateConfirmPassword, validateNewPassword } from "../global/validation";
import { displayFailureLimitReachedInfoModal, getMinutesTillRecoveryExpiry, reloadWithoutQueryString, } from "./recoveryUtils";
import revealPassword from "../global/revealPassword";
import popup from "../global/popup";
import axios, { AxiosError, AxiosResponse } from "../../../../node_modules/axios/index";
import ErrorSpan from "../global/ErrorSpan";
import { InfoModal, InfoModalConfig } from "../global/InfoModal";
import { RecoveryUpdatePasswordBody, RecoveryUpdatePasswordData, recoveryUpdatePasswordService } from "../services/accountServices";
import Cookies from "../global/Cookies";

const passwordUpdateFormElement: HTMLFormElement | null = document.querySelector('#password-update-form');

const newPasswordInput: HTMLInputElement | null = document.querySelector('#new-password-input');
const confirmNewPasswordInput: HTMLInputElement | null = document.querySelector('#confirm-new-password-input');

const newPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#new-password-input-reveal-btn');
const confirmNewPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#confirm-new-password-input-reveal-btn');

export function passwordUpdateForm(): void {
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

  if (!recoveryState.recoveryAccountId || !recoveryState.recoveryStartTimestamp || !recoveryState.recoveryToken) {
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
    const { newAuthToken } = recoveryUpdatePasswordData.data.resData;

    Cookies.set('authToken', newAuthToken);
    popup('Account recovery successful.', 'success');

    setTimeout(() => window.location.replace('account.html'), 1000);

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
    const errResData: { [key: string]: unknown } | undefined = axiosError.response.data.resData;

    LoadingModal.remove();
    popup(errMessage, 'error')

    if (status === 400) {
      if (errReason === 'password') {
        ErrorSpan.display(newPasswordInput, errMessage);
        return;
      };

      if (errReason === 'accountId' || errReason === 'recoveryToken') {
        displayIncorrectRecoveryLinkDataInfoModal(errMessage);
        return;
      };

      return;
    };

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => reloadWithoutQueryString(), 1000);

      return;
    };

    if (status === 403 && errResData) {
      if (!('requestTimestamp' in errResData) || typeof errResData.requestTimestamp !== 'number') {
        return;
      };

      const requestTimestamp: number = errResData.requestTimestamp;
      recoveryState.recoveryStartTimestamp = requestTimestamp;

      displayFailureLimitReachedInfoModal(errMessage, recoveryState.recoveryStartTimestamp);
      return;
    };

    if (status === 401) {
      if (errReason === 'incorrectRecoveryToken') {
        displayIncorrectRecoveryLinkDataInfoModal(errMessage);
        return;
      };

      if (errReason === 'recoverySuspended') {
        if (!errResData || !('requestTimestamp' in errResData) || typeof errResData.requestTimestamp !== 'number') {
          return;
        };

        const minutesTillExpiry: number = getMinutesTillRecoveryExpiry(errResData.requestTimestamp);
        const infoModalConfig: InfoModalConfig = {
          title: 'Recovery request suspended.',
          description: `Your recovery request has been suspended due to too many failed attempts. \n You can start the process again in ${minutesTillExpiry === 1 ? '1 minute' : `${minutesTillExpiry} minutes`}.`,
          btnTitle: 'Okay',
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
      };
    };
  };
};

function displayIncorrectRecoveryLinkDataInfoModal(errMessage: string): void {
  const infoModalConfig: InfoModalConfig = {
    title: errMessage,
    description: 'Make sure to click the correct link in your recovery email.',
    btnTitle: 'Okay',
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