import { recoveryState } from "./recoveryState";
import LoadingModal from "../global/LoadingModal";
import { validateCode, validateConfirmPassword, validateNewPassword } from "../global/validation";
import { handleRecoverySuspension, handleSignedInUser, reloadWithoutQueryString, } from "./recoveryUtils";
import revealPassword from "../global/revealPassword";
import popup from "../global/popup";
import ErrorSpan from "../global/ErrorSpan";
import { RecoveryUpdatePasswordBody, recoveryUpdatePasswordService, resendAccountRecoveryEmailService } from "../services/accountServices";
import { EMAILS_SENT_LIMIT } from "../global/clientConstants";
import { AsyncErrorData, getAsyncErrorData } from "../global/errorUtils";

const passwordUpdateFormElement: HTMLFormElement | null = document.querySelector('#password-update-form');

const newPasswordInput: HTMLInputElement | null = document.querySelector('#new-password-input');
const confirmNewPasswordInput: HTMLInputElement | null = document.querySelector('#confirm-new-password-input');
const recoveryCodeInput: HTMLInputElement | null = document.querySelector('#recovery-code-input');

const newPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#new-password-input-reveal-btn');
const confirmNewPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#confirm-new-password-input-reveal-btn');

const resendRecoveryEmailBtn: HTMLButtonElement | null = document.querySelector('#resend-recovery-email-btn');

export function recoveryPasswordUpdateForm(): void {
  loadEventListeners();
  setActiveValidation();
};

function loadEventListeners(): void {
  passwordUpdateFormElement?.addEventListener('submit', updateAccountPassword);
  resendRecoveryEmailBtn?.addEventListener('click', resendAccountRecoveryEmail);

  newPasswordRevealBtn?.addEventListener('click', () => revealPassword(newPasswordRevealBtn));
  confirmNewPasswordRevealBtn?.addEventListener('click', () => revealPassword(confirmNewPasswordRevealBtn));
};

async function updateAccountPassword(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (!recoveryState.inPasswordUpdateStage) {
    LoadingModal.remove();
    return;
  };

  if (!recoveryState.accountId || !recoveryState.expiryTimestamp) {
    popup('Something went wrong.', 'error');
    setTimeout(() => reloadWithoutQueryString(), 1000);

    return;
  };

  if (!recoveryCodeInput || !newPasswordInput || !confirmNewPasswordInput) {
    popup('Something went wrong.', 'error');
    setTimeout(() => window.location.reload(), 1000);

    return;
  };

  const isValidRecoveryCode: boolean = validateCode(recoveryCodeInput);
  const isValidNewPassword: boolean = validateNewPassword(newPasswordInput);

  if (!isValidRecoveryCode || !isValidNewPassword) {
    LoadingModal.remove();
    return;
  };

  const recoveryUpdatePasswordBody: RecoveryUpdatePasswordBody = {
    accountId: recoveryState.accountId,
    recoveryCode: recoveryCodeInput.value.toUpperCase(),
    newPassword: newPasswordInput.value,
  };

  try {
    const authSessionCreated: boolean = (await recoveryUpdatePasswordService(recoveryUpdatePasswordBody)).data.authSessionCreated;
    const redirectHref: string = authSessionCreated ? 'account' : 'sign-in'

    popup('Account recovery successful.', 'success');
    setTimeout(() => window.location.replace(redirectHref), 1000);

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason, errResData } = asyncErrorData;

    if (status === 400 && !errReason) {
      popup('Something went wrong.', 'error');
      return;
    };

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

    if (status === 401) {
      ErrorSpan.display(recoveryCodeInput, errMessage);

      if (errReason === 'recoverySuspended') {
        handleRecoverySuspension(errResData);
      };

      return;
    };

    if (status === 403) {
      if (errReason === 'signedIn') {
        handleSignedInUser();
        return;
      };

      handleRecoverySuspension(errResData);
      return;
    };

    if (status === 400) {
      const inputRecord: Record<string, HTMLInputElement | undefined> = {
        invalidRecoveryCode: recoveryCodeInput,
        invalidPassword: newPasswordInput,
      };

      const input: HTMLInputElement | undefined = inputRecord[`${errReason}`];
      if (input) {
        ErrorSpan.display(input, errMessage);
      };
    };
  };
};

async function resendAccountRecoveryEmail(): Promise<void> {
  LoadingModal.display();

  if (!recoveryState.inPasswordUpdateStage) {
    LoadingModal.remove();
    return;
  };

  if (!recoveryState.accountId) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (recoveryState.recoveryEmailsSent >= EMAILS_SENT_LIMIT) {
    popup(`Verification email limit of ${EMAILS_SENT_LIMIT} reached.`, 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await resendAccountRecoveryEmailService({ accountId: recoveryState.accountId });
    recoveryState.recoveryEmailsSent++;

    popup('Recovery email resent.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason, errResData } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 403) {
      recoveryState.recoveryEmailsSent = EMAILS_SENT_LIMIT;
      return;
    };

    if (status === 404) {
      LoadingModal.display();
      setTimeout(() => window.location.reload(), 1000);

      return;
    };

    if (status === 403) {
      if (errReason === 'recoverySuspended') {
        handleRecoverySuspension(errResData);
        return;
      };

      recoveryState.recoveryEmailsSent = EMAILS_SENT_LIMIT;
    };
  };
};

function setActiveValidation(): void {
  recoveryCodeInput?.addEventListener('input', () => validateCode(recoveryCodeInput));

  newPasswordInput?.addEventListener('input', () => {
    validateNewPassword(newPasswordInput);
    confirmNewPasswordInput && validateConfirmPassword(confirmNewPasswordInput, newPasswordInput);
  });

  confirmNewPasswordInput?.addEventListener('input', () => {
    newPasswordInput && validateConfirmPassword(confirmNewPasswordInput, newPasswordInput);
  });
};