import axios, { AxiosError } from "../../../../node_modules/axios/index";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { resendAccountRecoveryEmailService } from "../services/accountServices";
import { RecoveryStage, recoveryState } from "./recoveryState";
import { handleRecoverySuspended, initRecoveryTimers } from "./recoveryUtils";

const recoveryConfirmationFormElement: HTMLFormElement | null = document.querySelector('#recovery-confirmation-form');

export function recoveryConfirmationForm(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  recoveryConfirmationFormElement?.addEventListener('submit', resendAccountRecoveryEmail);
  document.addEventListener('recoveryStarted', initRecoveryTimers);
};

async function resendAccountRecoveryEmail(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (recoveryState.currentStage !== RecoveryStage.confirmationForm) {
    popup(`Recovery process not yet started.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (!recoveryState.recoveryEmail) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await resendAccountRecoveryEmailService({ email: recoveryState.recoveryEmail });

    popup('Recovery email resent.', 'success');
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
    const errResData: unknown = axiosError.response.data.resData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 404) {
      setTimeout(() => window.location.reload(), 1000);
      return;
    };

    if (status === 403 && errReason === 'recoverySuspended') {
      if (!errResData || typeof errResData !== 'object') {
        return;
      };

      if (!('expiryTimestamp' in errResData) || typeof errResData.expiryTimestamp !== 'number') {
        return;
      };

      handleRecoverySuspended(errResData.expiryTimestamp);
    };
  };
};