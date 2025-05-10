export default function revealPassword(passwordRevealBtn: HTMLButtonElement): void {
  const inputElement: Element | null = passwordRevealBtn.previousElementSibling;

  if (passwordRevealBtn?.classList.contains('revealed')) {
    passwordRevealBtn.classList.remove('revealed');
    inputElement?.setAttribute('type', 'password');

    updateBtnAttributes(passwordRevealBtn, false);
    return;
  };

  passwordRevealBtn?.classList.add('revealed');
  inputElement?.setAttribute('type', 'text');
  updateBtnAttributes(passwordRevealBtn, true);
};

function updateBtnAttributes(passwordRevalBtn: HTMLButtonElement, passwordRevealed: boolean): void {
  const btnTitle: string | null = passwordRevalBtn.getAttribute('title');
  const btnAriaLabel: string | null = passwordRevalBtn.getAttribute('aria-label');

  if (!btnTitle || !btnAriaLabel) {
    return;
  };

  if (passwordRevealed) {
    passwordRevalBtn.setAttribute('title', btnTitle.replace('Reveal', 'Hide'));
    passwordRevalBtn.setAttribute('aria-label', btnAriaLabel.replace('Reveal', 'Hide'));

    return;
  };

  passwordRevalBtn.setAttribute('title', btnTitle.replace('Hide', 'Reveal'));
  passwordRevalBtn.setAttribute('aria-label', btnAriaLabel.replace('Hide', 'Reveal'));
};