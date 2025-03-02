import { hangoutFormState } from "./hangoutFormState";
import revealPassword from "../global/revealPassword";
import ErrorSpan from "../global/ErrorSpan";
import { validateHangoutTitle, validateNewPassword } from "../global/validation";
import popup from "../global/popup";

const hangoutTitleInput: HTMLInputElement | null = document.querySelector('#hangout-title-input');

const hangoutPasswordToggleBtn: HTMLElement | null = document.querySelector('#hangout-password-toggle-btn');
const hangoutPasswordInput: HTMLInputElement | null = document.querySelector('#hangout-password-input');
const hangoutPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#hangout-password-input-reveal-btn');


export function hangoutFormFirstStep(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  hangoutTitleInput?.addEventListener('input', () => { validateHangoutTitle(hangoutTitleInput) });
  hangoutPasswordInput?.addEventListener('input', () => { validateNewPassword(hangoutPasswordInput) });

  hangoutPasswordToggleBtn?.addEventListener('click', toggleHangoutPassword);
  hangoutPasswordRevealBtn?.addEventListener('click', () => revealPassword(hangoutPasswordRevealBtn));
};

function toggleHangoutPassword(): void {
  hangoutFormState.isPasswordProtected = !hangoutFormState.isPasswordProtected;

  if (hangoutFormState.isPasswordProtected) {
    hangoutPasswordToggleBtn?.classList.add('checked');
    hangoutPasswordInput?.parentElement?.classList.remove('disabled');
    hangoutPasswordInput && (hangoutPasswordInput.disabled = false);

    return;
  };

  if (!hangoutFormState.isPasswordProtected) {
    hangoutPasswordToggleBtn?.classList.remove('checked');
    hangoutPasswordInput?.parentElement?.classList.add('disabled');
    hangoutPasswordInput && (hangoutPasswordInput.disabled = true);

    hangoutPasswordInput && (hangoutPasswordInput.value = '');
    hangoutPasswordInput && ErrorSpan.hide(hangoutPasswordInput);
  };
};

export function isValidFormFirstStepDetails(): boolean {
  if (!hangoutTitleInput || !hangoutPasswordInput) {
    popup('Invalid configuration.', 'error');
    return false;
  };

  const isValidHangoutTitle: boolean = validateHangoutTitle(hangoutTitleInput);

  if (isValidHangoutTitle) {
    hangoutFormState.hangoutTitle = hangoutTitleInput.value;

  } else {
    popup(`A valid hangout title is required.`, 'error');
    return false;
  };

  if (hangoutFormState.isPasswordProtected) {
    const isValidHangoutPassword: boolean = validateNewPassword(hangoutPasswordInput);

    if (isValidHangoutPassword) {
      hangoutFormState.hangoutPassword = hangoutPasswordInput.value;

    } else {
      popup('A valid hangout password is required.', 'error');
      return false;
    };
  };

  return true;
};