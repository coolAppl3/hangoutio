import { getFullDateSTring } from "../global/dateTimeUtils";
import ErrorSpan from "../global/ErrorSpan";
import { validateConfirmPassword, validateDisplayName, validateEmail, validateNewPassword, validatePassword } from "../global/validation";
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

  // TODO: implement
};

async function updateDisplayName(): Promise<void> {
  // TODO: implement
};

async function updatePassword(): Promise<void> {
  // TODO: implement
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