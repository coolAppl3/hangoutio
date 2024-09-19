export default function revealPassword(passwordRevealBtn: HTMLButtonElement): void {
  const inputElement: Element | null = passwordRevealBtn.previousElementSibling;

  if (passwordRevealBtn?.classList.contains('revealed')) {
    passwordRevealBtn.classList.remove('revealed');
    inputElement?.setAttribute('type', 'password');
    return;
  };

  passwordRevealBtn?.classList.add('revealed');
  inputElement?.setAttribute('type', 'text');
};