import { hangoutCreationState } from "./hangoutCreationState";
import revealPassword from "../global/revealPassword";
import ErrorSpan from "../global/ErrorSpan";
import { validateHangoutTitle, validateNewPassword } from "../global/validation";
import popup from "../global/popup";

const hangoutTitleInput: HTMLInputElement | null = document.querySelector('#hangout-title-input');

const hangoutPasswordToggleBtn: HTMLElement | null = document.querySelector('#hangout-password-toggle-btn');
const hangoutPasswordInput: HTMLInputElement | null = document.querySelector('#hangout-password-input');
const hangoutPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#hangout-password-input-reveal-btn');


export function formFirstStep(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  hangoutTitleInput?.addEventListener('input', () => { validateHangoutTitle(hangoutTitleInput) });
  hangoutPasswordInput?.addEventListener('input', () => { validateNewPassword(hangoutPasswordInput) });

  hangoutPasswordToggleBtn?.addEventListener('click', toggleHangoutPassword);
  hangoutPasswordRevealBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();
    revealPassword(hangoutPasswordRevealBtn);
  });
};

function toggleHangoutPassword(e: MouseEvent): void {
  e.preventDefault();

  if (!(e.target instanceof HTMLElement)) {
    return;
  };

  if (hangoutPasswordToggleBtn?.classList.contains('checked')) {
    hangoutPasswordToggleBtn?.classList.remove('checked');

    hangoutPasswordInput?.parentElement?.classList.add('disabled');
    hangoutPasswordInput?.setAttribute('disabled', '');

    clearPasswordInput();
    hangoutPasswordInput ? ErrorSpan.hide(hangoutPasswordInput) : undefined;

    hangoutCreationState.isPasswordProtected = false;
    return;
  };

  hangoutPasswordToggleBtn?.classList.add('checked');
  hangoutPasswordInput?.parentElement?.classList.remove('disabled');
  hangoutPasswordInput?.removeAttribute('disabled');

  hangoutCreationState.isPasswordProtected = true;
};

function clearPasswordInput(): void {
  hangoutPasswordInput ? hangoutPasswordInput.value = '' : undefined;
};

export function isValidFormFirstStepDetails(): boolean {
  if (!hangoutTitleInput || !hangoutPasswordInput) {
    popup('Invalid configuration.', 'error');
    return false;
  };

  const isValidHangoutTitle: boolean = validateHangoutTitle(hangoutTitleInput);

  if (isValidHangoutTitle) {
    hangoutCreationState.hangoutTitle = hangoutTitleInput.value;

  } else {
    popup(`A valid hangout title is required.`, 'error');
    return false;
  };

  if (hangoutCreationState.isPasswordProtected) {
    const isValidHangoutPassword: boolean = validateNewPassword(hangoutPasswordInput);

    if (isValidHangoutPassword) {
      hangoutCreationState.hangoutPassword = hangoutPasswordInput.value;

    } else {
      popup('A valid hangout password is required.', 'error');
      return false;
    };
  };

  return true;
};