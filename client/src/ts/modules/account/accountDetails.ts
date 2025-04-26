import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../global/authUtils";
import { getFullDateSTring } from "../global/dateTimeUtils";
import ErrorSpan from "../global/ErrorSpan";
import { AsyncErrorData, getAsyncErrorData } from "../global/errorUtils";
import { InfoModal } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { validateCode, validateConfirmPassword, validateDisplayName, validateEmail, validateNewPassword, validatePassword } from "../global/validation";
import { startAccountDeletionService, startEmailUpdateService, updateDisplayNameService, updatePasswordService } from "../services/accountServices";
import { displayRequestSuspendedInfoModal, handleAccountLocked, handleOngoingOpposingRequest, handleOngoingRequest, handleRequestSuspended } from "./accountUtils";
import { accountState } from "./initAccount";

type DetailsUpdateFormPurpose = 'emailUpdate' | 'displayNameUpdate' | 'passwordUpdate' | 'deleteAccount';
type ConfirmationFormPurpose = 'confirmEmailUpdate' | 'confirmAccountDeletion';

interface AccountDetailsState {
  detailsUpdateFormPurpose: DetailsUpdateFormPurpose | null,
  confirmationFormPurpose: ConfirmationFormPurpose | null,

  accountDeletionSuspensionExpiryTimestamp: number | null,
  emailUpdateSuspensionExpiryTimestamp: number | null,
};

export const accountDetailsState: AccountDetailsState = {
  detailsUpdateFormPurpose: null,
  confirmationFormPurpose: null,

  accountDeletionSuspensionExpiryTimestamp: null,
  emailUpdateSuspensionExpiryTimestamp: null,
};

const detailsElement: HTMLDivElement | null = document.querySelector('#details');
const detailsDropdownElement: HTMLDivElement | null = document.querySelector('#details-dropdown');

const detailsUpdateForm: HTMLFormElement | null = document.querySelector('#details-update-form');
const detailsUpdateFormTitle: HTMLHeadingElement | null = document.querySelector('#details-update-form-title');
const newEmailInput: HTMLInputElement | null = document.querySelector('#new-email-input');
const newDisplayNameInput: HTMLInputElement | null = document.querySelector('#new-display-name-input');
const passwordInput: HTMLInputElement | null = document.querySelector('#password-input');
const newPasswordInput: HTMLInputElement | null = document.querySelector('#new-password-input');
const confirmNewPasswordInput: HTMLInputElement | null = document.querySelector('#confirm-new-password-input');

const confirmationForm: HTMLFormElement | null = document.querySelector('#confirmation-form');
const confirmationFormTitle: HTMLHeadElement | null = document.querySelector('#confirmation-form-title');
const confirmationCodeInput: HTMLInputElement | null = document.querySelector('#confirmation-code-input');

export function initAccountDetails(): void {
  loadEventListeners();

  renderAccountDetails();
  setActiveValidation();
};

function loadEventListeners(): void {
  detailsUpdateForm?.addEventListener('submit', handleDetailsUpdateFormSubmission);
  confirmationForm?.addEventListener('submit', handleConfirmationFormSubmission);

  detailsElement?.addEventListener('click', handleDetailsElementClicks);
};

function renderAccountDetails(): void {
  if (!accountState.data) {
    return;
  };

  const { accountDetails, hangoutsJoinedCount, ongoingHangoutsCount } = accountState.data;

  const displayNameElement: HTMLHeadElement | null = document.querySelector('#display-name');
  displayNameElement && (displayNameElement.textContent = accountDetails.display_name);

  const usernameElement: HTMLParagraphElement | null = document.querySelector('#username');
  usernameElement && (usernameElement.textContent = `@${accountDetails.username}`);

  const emailSpan: HTMLSpanElement | null = document.querySelector('#email-span');
  emailSpan && (emailSpan.textContent = accountDetails.email);

  const createdOnSpan: HTMLSpanElement | null = document.querySelector('#created-on-span');
  createdOnSpan && (createdOnSpan.textContent = getFullDateSTring(accountDetails.created_on_timestamp));

  const hangoutsJoinedSpan: HTMLSpanElement | null = document.querySelector('#hangouts-joined-span');
  hangoutsJoinedSpan && (hangoutsJoinedSpan.textContent = `${hangoutsJoinedCount}`);

  const ongoingHangoutsSpan: HTMLSpanElement | null = document.querySelector('#ongoing-hangouts-span');
  ongoingHangoutsSpan && (ongoingHangoutsSpan.textContent = `${ongoingHangoutsCount}`);
};

async function handleDetailsUpdateFormSubmission(e: SubmitEvent): Promise<void> {
  e.preventDefault();

  if (accountDetailsState.detailsUpdateFormPurpose === 'displayNameUpdate') {
    await updateDisplayName();
    return;
  };

  if (accountDetailsState.detailsUpdateFormPurpose === 'passwordUpdate') {
    await updatePassword();
    return;
  };

  if (accountDetailsState.detailsUpdateFormPurpose === 'emailUpdate') {
    await startEmailUpdate();
    return;
  };

  if (accountDetailsState.detailsUpdateFormPurpose === 'deleteAccount') {
    await startAccountDeletion();
    return;
  };

  popup('Something went wrong.', 'error');
  hideDetailsUpdateForm();
};

async function handleConfirmationFormSubmission(e: SubmitEvent): Promise<void> {
  e.preventDefault();

  // TODO: implement
};

async function updateDisplayName(): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!passwordInput || !newDisplayNameInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidPassword: boolean = validatePassword(passwordInput);
  const isValidDisplayName: boolean = validateDisplayName(newDisplayNameInput);

  if (!isValidPassword || !isValidDisplayName) {
    popup('Invalid details.', 'error');
    LoadingModal.remove();

    return;
  };

  const password: string = passwordInput.value;
  const newDisplayName: string = newDisplayNameInput.value;

  if (newDisplayName === accountState.data.accountDetails.display_name) {
    popup(`Your display name is already ${newDisplayName}.`, 'info');
    LoadingModal.remove();

    return;
  };

  try {
    await updateDisplayNameService({ password, newDisplayName });
    accountState.data.accountDetails.display_name = newDisplayName;

    hideDetailsUpdateForm();
    renderAccountDetails();

    popup('Display name updated.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    popup(errMessage, 'error');

    if (status === 401) {
      if (errReason === 'accountLocked') {
        handleAccountLocked();
        return;
      };

      if (errReason === 'incorrectPassword') {
        ErrorSpan.display(passwordInput, errMessage);
        return;
      };

      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
      return;
    };

    if (status === 400) {
      if (errReason === 'password') {
        ErrorSpan.display(passwordInput, errMessage);
        return;
      };

      if (errReason === 'displayName') {
        ErrorSpan.display(newDisplayNameInput, errMessage);
      };
    };
  };
};

async function updatePassword(): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!passwordInput || !newPasswordInput || !confirmNewPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidPassword: boolean = validatePassword(passwordInput);
  const isValidNewPassword: boolean = validateNewPassword(newPasswordInput);
  const isValidConfirmPassword: boolean = validateConfirmPassword(confirmNewPasswordInput, newPasswordInput);

  if (!isValidConfirmPassword) {
    popup(`New password inputs don't match.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (!isValidNewPassword || !isValidPassword) {
    popup('Invalid details.', 'error');
    LoadingModal.remove();

    return;
  };

  const password: string = passwordInput.value;
  const newPassword: string = newPasswordInput.value;

  if (newPassword === accountState.data.accountDetails.username) {
    ErrorSpan.display(newPasswordInput, `New password can't be identical to your username.`);

    popup(`New password can't be identical to your username.`, 'error');
    LoadingModal.remove();

    return;
  };

  try {
    const authSessionCreated: boolean = (await updatePasswordService({ currentPassword: password, newPassword })).data.authSessionCreated;

    hideDetailsUpdateForm();

    popup('Password updated.', 'success');
    LoadingModal.remove();

    if (authSessionCreated) {
      return;
    };

    const infoModal: HTMLDivElement = InfoModal.display({
      title: 'Password updated successfully.',
      description: `You'll just have to sign in again to complete the process.`,
      btnTitle: 'Okay',
    });

    infoModal.addEventListener('click', (e: MouseEvent) => {
      if (!(e.target instanceof HTMLButtonElement)) {
        return;
      };

      if (e.target.id === 'info-modal-btn') {
        window.location.href = 'sign-in';
      };
    });

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    popup(errMessage, 'error');

    if (status === 409) {
      ErrorSpan.display(newPasswordInput, errMessage);
      return;
    };

    if (status === 401) {
      if (errReason === 'accountLocked') {
        handleAccountLocked();
        return;
      };

      if (errReason === 'incorrectPassword') {
        ErrorSpan.display(passwordInput, errMessage);
        return;
      };

      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
      return;
    };

    if (status === 400) {
      if (errReason === 'currentPassword') {
        ErrorSpan.display(passwordInput, errMessage);
        return;
      };

      if (errReason === 'newPassword') {
        ErrorSpan.display(newPasswordInput, errMessage);
      };
    };
  };
};

async function startEmailUpdate(): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (accountDetailsState.confirmationFormPurpose === 'confirmEmailUpdate') {
    popup(`There's already an ongoing email update request.`, 'error');
    return;
  };

  if (accountDetailsState.confirmationFormPurpose === 'confirmAccountDeletion') {
    handleOngoingOpposingRequest('account deletion');
    return;
  };

  if (!passwordInput || !newEmailInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidNewEmail: boolean = validateEmail(newEmailInput);
  const isValidPassword: boolean = validatePassword(passwordInput);

  if (!isValidPassword || !isValidNewEmail) {
    popup('Invalid confirmation data.', 'error');
    LoadingModal.remove();

    return;
  };

  const password: string = passwordInput.value;
  const newEmail: string = newEmailInput.value;

  if (newEmail === accountState.data.accountDetails.email) {
    popup('This email is already assigned to your account..', 'info');
    LoadingModal.remove();

    return;
  };

  try {
    await startEmailUpdateService({ password, newEmail });

    accountDetailsState.confirmationFormPurpose = 'confirmEmailUpdate';
    displayConfirmationForm();

    popup('Email update started.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason, errResData } = asyncErrorData;

    popup(errMessage, 'error');

    if (status === 409) {
      if (errReason === 'ongoingRequest') {
        handleOngoingRequest(errResData, 'email update');
        return;
      };

      if (errReason === 'ongoingAccountDeletion') {
        handleOngoingOpposingRequest('account deletion');
        return;
      };

      if (errReason === 'identicalEmail' || errReason === 'emailTaken') {
        ErrorSpan.display(newEmailInput, errMessage);
      };

      return;
    };

    if (status === 401) {
      if (errReason === 'accountLocked') {
        handleAccountLocked();
        return;
      };

      if (errReason === 'incorrectPassword') {
        ErrorSpan.display(passwordInput, errMessage);
        return;
      };

      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
      return;
    };

    if (status === 400) {
      if (errReason === 'email') {
        ErrorSpan.display(newEmailInput, errMessage);
        return;
      };

      if (errReason === 'password') {
        ErrorSpan.display(passwordInput, errMessage);
      };
    };
  };
};

async function startAccountDeletion(): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (accountDetailsState.accountDeletionSuspensionExpiryTimestamp) {
    displayRequestSuspendedInfoModal('account deletion', accountDetailsState.accountDeletionSuspensionExpiryTimestamp);
    LoadingModal.remove();

    return;
  };

  if (accountDetailsState.confirmationFormPurpose === 'confirmAccountDeletion') {
    popup(`There's already an ongoing account deletion request.`, 'error');
    LoadingModal.remove();

    return;
  };

  if (accountDetailsState.confirmationFormPurpose === 'confirmEmailUpdate') {
    handleOngoingOpposingRequest('email update');
    LoadingModal.remove();

    return;
  };

  if (!passwordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidPassword: boolean = validatePassword(passwordInput);

  if (!isValidPassword) {
    popup('Invalid password.', 'error');
    LoadingModal.remove();

    return;
  };

  const password: string = passwordInput.value;

  try {
    await startAccountDeletionService(password);

    accountDetailsState.confirmationFormPurpose = 'confirmAccountDeletion';
    displayConfirmationForm();

    popup('Account deletion process started.', 'success');
    LoadingModal.remove();

    InfoModal.display({
      title: 'Account deletion process started.',
      description: `You'll receive an email within the next 30 seconds with a confirmation code.`,
      btnTitle: 'Okay',
    }, { simple: true });

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
      return;
    };

    const { status, errMessage, errReason, errResData } = asyncErrorData;

    popup(errMessage, 'error');

    if (status === 403) {
      handleRequestSuspended(errResData, 'account deletion');
      return;
    };

    if (status === 409) {
      if (errReason === 'ongoingRequest') {
        handleOngoingRequest(errResData, 'account deletion');
        return;
      };

      if (errReason === 'ongoingEmailUpdate') {
        handleOngoingOpposingRequest('email update');
      };

      return;
    };

    if (status === 401) {
      if (errReason === 'accountLocked') {
        handleAccountLocked();
        return;
      };

      if (errReason === 'incorrectPassword') {
        ErrorSpan.display(passwordInput, errMessage);
        return;
      };

      if (errReason === 'authSessionExpired') {
        handleAuthSessionExpired();
        return;
      };

      handleAuthSessionDestroyed();
      return;
    };

    if (status === 400 && errReason === 'password') {
      ErrorSpan.display(passwordInput, errMessage);
    };
  };
};

function handleDetailsElementClicks(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'details-dropdown-btn') {
    detailsDropdownElement?.classList.toggle('expanded');
    return;
  };

  if (e.target.id === 'update-display-name-btn') {
    displayDetailsUpdateForm('displayNameUpdate', 'Update display name');
    return;
  };

  if (e.target.id === 'update-password-btn') {
    displayDetailsUpdateForm('passwordUpdate', 'Update password');
    return;
  };

  if (e.target.id === 'update-email-btn') {
    displayDetailsUpdateForm('emailUpdate', 'Start email update process');
    return;
  };

  if (e.target.id === 'delete-account-btn') {
    displayDetailsUpdateForm('deleteAccount', 'Start account deletion process');
    return;
  };

  if (e.target.id === 'details-update-form-cancel-btn') {
    hideDetailsUpdateForm();
  };
};

function displayDetailsUpdateForm(purpose: DetailsUpdateFormPurpose, purposeTitle: string): void {
  if (!detailsUpdateForm) {
    return;
  };

  accountDetailsState.detailsUpdateFormPurpose = purpose;

  for (const formGroup of detailsUpdateForm.children) {
    if (!formGroup.classList.contains('form-group')) {
      continue;
    };

    const formGroupPurpose: string | null = formGroup.getAttribute('data-purpose');

    if (!formGroupPurpose || formGroupPurpose === 'all') {
      continue;
    };

    if (formGroupPurpose !== purpose) {
      formGroup.classList.add('hidden');
      continue
    };

    formGroup.classList.remove('hidden');
  };

  detailsUpdateFormTitle && (detailsUpdateFormTitle.textContent = purposeTitle);

  detailsUpdateForm.classList.remove('hidden');
  detailsDropdownElement?.classList.remove('expanded');
};

function hideDetailsUpdateForm(): void {
  if (!detailsUpdateForm) {
    return;
  };

  accountDetailsState.detailsUpdateFormPurpose = null;

  detailsUpdateForm?.classList.add('hidden');
  detailsDropdownElement?.classList.remove('expanded');

  if (!newEmailInput || !newDisplayNameInput || !passwordInput || !newPasswordInput || !confirmNewPasswordInput) {
    return;
  };

  newEmailInput.value = '';
  newDisplayNameInput.value = '';
  passwordInput.value = '';
  newPasswordInput.value = '';
  confirmNewPasswordInput.value = '';

  ErrorSpan.hide(newEmailInput);
  ErrorSpan.hide(newDisplayNameInput);
  ErrorSpan.hide(passwordInput);
  ErrorSpan.hide(newPasswordInput);
  ErrorSpan.hide(confirmNewPasswordInput);
};

function displayConfirmationForm(): void {
  if (!confirmationForm || !confirmationFormTitle) {
    return;
  };

  if (!accountDetailsState.confirmationFormPurpose) {
    return;
  };

  confirmationFormTitle.textContent = `Complete your ${accountDetailsState.confirmationFormPurpose === 'confirmEmailUpdate' ? 'email update' : 'account deletion'} request.`;
  confirmationForm.classList.remove('hidden');
};

function setActiveValidation(): void {
  newEmailInput?.addEventListener('input', () => validateEmail(newEmailInput));
  newDisplayNameInput?.addEventListener('input', () => validateDisplayName(newDisplayNameInput));
  passwordInput?.addEventListener('input', () => validatePassword(passwordInput));
  confirmationCodeInput?.addEventListener('input', () => validateCode(confirmationCodeInput));

  newPasswordInput?.addEventListener('input', () => {
    validateNewPassword(newPasswordInput);
    confirmNewPasswordInput && validateConfirmPassword(confirmNewPasswordInput, newPasswordInput);
  });

  confirmNewPasswordInput?.addEventListener('input', () => {
    newPasswordInput && validateConfirmPassword(confirmNewPasswordInput, newPasswordInput);
  });
};