import { handleAuthSessionDestroyed, handleAuthSessionExpired } from "../global/authUtils";
import { getFullDateSTring } from "../global/dateTimeUtils";
import ErrorSpan from "../global/ErrorSpan";
import { AsyncErrorData, getAsyncErrorData } from "../global/errorUtils";
import { InfoModal } from "../global/InfoModal";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { validateConfirmPassword, validateDisplayName, validateEmail, validateNewPassword, validatePassword } from "../global/validation";
import { updateDisplayNameService, updatePasswordService } from "../services/accountServices";
import { accountState } from "./initAccount";

type DetailsUpdateFormPurpose = 'emailUpdate' | 'displayNameUpdate' | 'passwordUpdate' | 'deleteAccount';

interface AccountDetailsState {
  detailsUpdateFormPurpose: DetailsUpdateFormPurpose | null,
};

const accountDetailsState: AccountDetailsState = {
  detailsUpdateFormPurpose: null,
};

const detailsElement: HTMLDivElement | null = document.querySelector('#details');
const detailsDropdownElement: HTMLDivElement | null = document.querySelector('#details-dropdown');

const detailsUpdateForm: HTMLFormElement | null = document.querySelector('#details-update-form');
const detailsUpdateFormTitle: HTMLHeadingElement | null = document.querySelector('#details-update-form-title');
const deleteAccountWarningElement: HTMLParagraphElement | null = document.querySelector('#delete-account-warning');

const newEmailInput: HTMLInputElement | null = document.querySelector('#new-email-input');
const newDisplayNameInput: HTMLInputElement | null = document.querySelector('#new-display-name-input');
const passwordInput: HTMLInputElement | null = document.querySelector('#password-input');
const newPasswordInput: HTMLInputElement | null = document.querySelector('#new-password-input');
const confirmNewPasswordInput: HTMLInputElement | null = document.querySelector('#confirm-new-password-input');

export function initAccountDetails(): void {
  loadEventListeners();

  renderAccountDetails();
  setActiveValidation();
};

function loadEventListeners(): void {
  detailsUpdateForm?.addEventListener('submit', handleFormSubmission);
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

async function handleFormSubmission(e: SubmitEvent): Promise<void> {
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
    await startUpdateEmail();
    return;
  };

  if (accountDetailsState.detailsUpdateFormPurpose === 'deleteAccount') {
    await startAccountDeletion();
    return;
  };

  popup('Something went wrong.', 'error');
  hideDetailsUpdateForm();
};

async function updateDisplayName(): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!newDisplayNameInput || !passwordInput) {
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

async function startUpdateEmail(): Promise<void> {
  // TODO: implement
};

async function startAccountDeletion(): Promise<void> {
  // TODO: implement
};

function handleDetailsElementClicks(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'details-dropdown-btn') {
    detailsDropdownElement?.classList.toggle('expanded');
    return;
  };

  if (e.target.id === 'update-email-btn') {
    displayDetailsUpdateForm('emailUpdate', 'Update email address');
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

  if (e.target.id === 'delete-account-btn') {
    displayDetailsUpdateForm('deleteAccount', 'Delete account');
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

  if (purpose === 'deleteAccount') {
    deleteAccountWarningElement?.classList.remove('hidden');
    detailsUpdateForm.classList.add('danger');

  } else {
    deleteAccountWarningElement?.classList.add('hidden');
    detailsUpdateForm.classList.remove('danger');
  };

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

function setActiveValidation(): void {
  newEmailInput?.addEventListener('input', () => validateEmail(newEmailInput));
  newDisplayNameInput?.addEventListener('input', () => validateDisplayName(newDisplayNameInput));
  passwordInput?.addEventListener('input', () => validatePassword(passwordInput));

  newPasswordInput?.addEventListener('input', () => {
    validateNewPassword(newPasswordInput);
    confirmNewPasswordInput && validateConfirmPassword(confirmNewPasswordInput, newPasswordInput);
  });

  confirmNewPasswordInput?.addEventListener('input', () => {
    newPasswordInput && validateConfirmPassword(confirmNewPasswordInput, newPasswordInput);
  });
};