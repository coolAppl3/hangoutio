import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import revealPassword from "../../global/revealPassword";
import { validatePassword } from "../../global/validation";
import { joinHangoutAsAccount } from "./handleNotHangoutMember";

export function initJoinHangoutForm(): void {
  const joinHangoutFormContainer: HTMLDivElement = createJoinHangoutFormContainer();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      joinHangoutFormContainer.classList.add('revealed');
    });
  });
};

export function removeJoinHangoutForm(): void {
  const joinHangoutFormContainer: HTMLDivElement | null = document.querySelector('#join-hangout-form-container');
  joinHangoutFormContainer?.remove();
};

async function handleFormSubmission(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  const joinHangoutPasswordInput: HTMLInputElement | null = document.querySelector('#join-hangout-password-input');
  if (!joinHangoutPasswordInput) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  const isValidPassword: boolean = validatePassword(joinHangoutPasswordInput);
  if (!isValidPassword) {
    LoadingModal.remove();
    return;
  };

  await joinHangoutAsAccount();
};

function createJoinHangoutFormContainer(): HTMLDivElement {
  const joinHangoutFormContainer: HTMLDivElement = document.createElement('div');

  joinHangoutFormContainer.id = 'join-hangout-form-container';
  joinHangoutFormContainer.setAttribute('tabindex', '0');

  const joinHangoutForm: HTMLFormElement = createJoinHangoutForm();
  joinHangoutForm.addEventListener('submit', handleFormSubmission);

  joinHangoutForm.appendChild(createFormTitle());
  joinHangoutForm.appendChild(createFormDescription());
  joinHangoutForm.appendChild(createFormGroup());
  joinHangoutForm.appendChild(createBtnContainer());

  joinHangoutFormContainer.appendChild(joinHangoutForm);
  document.body.appendChild(joinHangoutFormContainer);

  return joinHangoutFormContainer;
};

function createJoinHangoutForm(): HTMLFormElement {
  const joinHangoutForm: HTMLFormElement = document.createElement('form');
  joinHangoutForm.id = 'join-hangout-form';

  return joinHangoutForm;
};

function createFormTitle(): HTMLParagraphElement {
  const title: HTMLParagraphElement = document.createElement('p');
  title.className = 'title';
  title.appendChild(document.createTextNode('Hangout password required.'));

  return title;
};

function createFormDescription(): HTMLParagraphElement {
  const description: HTMLParagraphElement = document.createElement('p');
  description.className = 'description';
  description.appendChild(document.createTextNode(`Please contact the hangout leader to request the password.`));

  return description;
};

function createFormGroup(): HTMLDivElement {
  const formGroup: HTMLDivElement = document.createElement('div');
  formGroup.className = 'form-group form-group-password relative';

  const label: HTMLLabelElement = document.createElement('label');
  label.setAttribute('for', 'join-hangout-password-input');
  label.appendChild(document.createTextNode('Hangout password'));

  const passwordInput: HTMLInputElement = document.createElement('input');
  passwordInput.setAttribute('type', 'password');
  passwordInput.id = 'join-hangout-password-input';
  passwordInput.setAttribute('autocomplete', 'new-password');
  passwordInput.addEventListener('input', () => validatePassword(passwordInput));

  const passwordRevealBtn: HTMLButtonElement = document.createElement('button');
  passwordRevealBtn.className = 'password-icon svg w-2 h-2 group';
  passwordRevealBtn.id = 'join-hangout-password-input-reveal-btn';
  passwordRevealBtn.setAttribute('type', 'button');
  passwordRevealBtn.setAttribute('aria-label', 'Reveal guest password');
  passwordRevealBtn.addEventListener('click', () => revealPassword(passwordRevealBtn));

  const existingPasswordRevealIcon: SVGElement | undefined | null = document.querySelector('#guest-sign-up-section')?.querySelector('svg');
  if (existingPasswordRevealIcon) {
    passwordRevealBtn.appendChild(existingPasswordRevealIcon.cloneNode(true));
  };

  const errorSpan: HTMLSpanElement = document.createElement('span');
  errorSpan.className = 'error-span';
  errorSpan.setAttribute('data-target', 'join-hangout-password-input');

  formGroup.appendChild(label);
  formGroup.appendChild(passwordInput);
  formGroup.appendChild(passwordRevealBtn);
  formGroup.appendChild(errorSpan);

  return formGroup;
};

function createBtnContainer(): HTMLDivElement {
  const btnContainer: HTMLDivElement = document.createElement('div');
  btnContainer.className = 'btn-container';

  const submitBtn: HTMLButtonElement = document.createElement('button');
  submitBtn.className = 'submit-btn';
  submitBtn.appendChild(document.createTextNode('Join hangout'));

  const cancelBtn: HTMLButtonElement = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.setAttribute('type', 'button');
  cancelBtn.appendChild(document.createTextNode('Got to homepage'));
  cancelBtn.addEventListener('click', () => window.location.href = 'index.html');

  btnContainer.appendChild(submitBtn);
  btnContainer.appendChild(cancelBtn);

  return btnContainer;
};