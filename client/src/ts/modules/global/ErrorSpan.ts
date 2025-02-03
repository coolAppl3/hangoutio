export default class ErrorSpan {
  public static display(input: HTMLInputElement | HTMLTextAreaElement | HTMLParagraphElement, message: string): void {
    ErrorSpan.hide(input);

    const span: HTMLSpanElement | null = document.querySelector(`[data-target="${input.id}"]`);
    span && (span.textContent = message);

    const inputFormGroup: HTMLElement | null = input.parentElement;
    inputFormGroup?.classList.add('error');
  };

  public static hide(input: HTMLInputElement | HTMLTextAreaElement | HTMLParagraphElement): void {
    const inputFormGroup: HTMLElement | null = input.parentElement;

    if (!inputFormGroup?.classList.contains('error')) {
      return;
    };

    inputFormGroup?.classList.remove('error');

    const span: HTMLSpanElement | null = document.querySelector(`[data-target="${input.id}"]`);
    span && (span.textContent = '');
  };
};