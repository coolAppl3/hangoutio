import axios, { AxiosError, AxiosResponse } from "../../../../node_modules/axios/index";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { SendRecoveryEmailData, sendRecoveryEmailService } from "../services/accountServices";
import { RecoveryStage, recoveryState } from "./recoveryState";
import { initRecoveryTimers } from "./recoveryUtils";

const recoveryConfirmationFormElement: HTMLFormElement | null = document.querySelector('#recovery-confirmation-form');

export function recoveryConfirmationForm(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  recoveryConfirmationFormElement?.addEventListener('submit', resendRecoveryEmail);
  document.addEventListener('recoveryStarted', initRecoveryTimers);
};

async function resendRecoveryEmail(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (recoveryState.currentStage !== RecoveryStage.confirmationForm) {
    LoadingModal.remove();
    return;
  };

  if (!recoveryState.recoveryEmail) {
    popup('Something went wrong.', 'error');
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  try {
    const sendRecoveryEmailData: AxiosResponse<SendRecoveryEmailData> = await sendRecoveryEmailService({ email: recoveryState.recoveryEmail });
    const { requestTimestamp } = sendRecoveryEmailData.data.resData;

    recoveryState.recoveryStartTimestamp = requestTimestamp;

    popup('Recovery email resent.', 'success');
    LoadingModal.remove();

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

    if (status === 400) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    LoadingModal.remove();
    popup(errMessage, 'error');

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };
  };
};