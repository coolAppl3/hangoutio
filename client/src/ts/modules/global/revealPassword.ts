export default function revealPassword(passwordIcon: HTMLElement): void {
  const inputElement: Element | null = passwordIcon.previousElementSibling;

  if (passwordIcon?.classList.contains('revealed')) {
    passwordIcon.classList.remove('revealed');
    inputElement?.setAttribute('type', 'password');
    return;
  };

  passwordIcon?.classList.add('revealed');
  inputElement?.setAttribute('type', 'text');
};