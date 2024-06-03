export default class ErrorSpan {
  public static display(input: HTMLElement, message: string): void {
    ErrorSpan.hide(input);

    const span: HTMLSpanElement | null = document.querySelector(`[data-target="${input.id}"]`);
    span ? span.textContent = message : undefined;

    const inputFormGroup: HTMLElement | null = input.parentElement;
    inputFormGroup?.classList.add('error');
  };

  public static hide(input: HTMLElement): void {
    const inputFormGroup: HTMLElement | null = input.parentElement;

    if (!inputFormGroup?.classList.contains('error')) {
      return;
    };

    inputFormGroup?.classList.remove('error');

    const span: HTMLSpanElement | null = document.querySelector(`[data-target="${input.id}"]`);
    span ? span.textContent = '' : undefined;
  };
};