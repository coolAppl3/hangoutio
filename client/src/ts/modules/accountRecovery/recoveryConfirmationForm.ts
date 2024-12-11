import axios, { AxiosError, AxiosResponse } from "../../../../node_modules/axios/index";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { SendRecoveryEmailData, sendRecoveryEmailService } from "../services/accountServices";
import { RecoveryStage, recoveryState } from "./recoveryState";
import { handleUserSignedIn, initRecoveryTimers } from "./recoveryUtils";

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
    const sendRecoveryEmailData: AxiosResponse<SendRecoveryEmailData> = await sendRecoveryEmailService({ email: recoveryState.recoveryEmail });
    const expiryTimestamp: number = sendRecoveryEmailData.data.resData.expiryTimestamp;


    // CONTINUE HEREEEEE ==========================
    // double-check literally everything before moving forward
    // Don't forget the cron jobs

    recoveryState.expiryTimestamp = expiryTimestamp;

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

    if (status === 400 || status === 404) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 403 && errReason === 'signedIn') {
      handleUserSignedIn();
      return;
    };
  };
};