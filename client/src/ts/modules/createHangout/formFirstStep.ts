import { formState } from "./formState";
import revealPassword from "../global/revealPassword";
import SliderInput from "../global/SliderInput";
import ErrorSpan from "../global/ErrorSpan";
import { validateNewPassword } from "../global/validation";

const memberLimitSlider: SliderInput = new SliderInput('member-limit-input', 'member', 2, 20, 10);

const hangoutPasswordToggleBtn: HTMLElement | null = document.querySelector('#hangout-password-toggle-btn');
const hangoutPasswordInput: HTMLInputElement | null = document.querySelector('#hangout-password-input');
const hangoutPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#hangout-password-input-reveal-btn');


export function formFirstStep(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  hangoutPasswordToggleBtn?.addEventListener('click', toggleHangoutPassword);
  hangoutPasswordInput?.addEventListener('input', setHangoutPassword);

  window.addEventListener('member-limit-value-change', () => {
    formState.memberLimit = memberLimitSlider.value;
  });

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

    formState.isPasswordProtected = false;
    return;
  };

  hangoutPasswordToggleBtn?.classList.add('checked');
  hangoutPasswordInput?.parentElement?.classList.remove('disabled');
  hangoutPasswordInput?.removeAttribute('disabled');

  formState.isPasswordProtected = true;
};

function clearPasswordInput(): void {
  hangoutPasswordInput ? hangoutPasswordInput.value = '' : undefined;
};

function setHangoutPassword(): void {
  if (!hangoutPasswordInput) {
    formState.hangoutPassword = null;
    return;
  };

  const isValidHangoutPassword: boolean = validateNewPassword(hangoutPasswordInput);

  if (!isValidHangoutPassword) {
    formState.hangoutPassword = null;
    return;
  };

  formState.hangoutPassword = hangoutPasswordInput.value;
};