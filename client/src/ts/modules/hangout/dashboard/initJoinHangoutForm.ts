import { createBtnElement, createDivElement, createParagraphElement, createSpanElement, createSvgElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import revealPassword from "../../global/revealPassword";
import { validatePassword } from "../../global/validation";
import { joinHangoutAsAccount } from "./handleNotHangoutMember";

export function initJoinHangoutForm(): void {
  const joinHangoutFormContainer: HTMLDivElement = createJoinHangoutFormContainer();
  joinHangoutFormContainer.focus();

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
  const joinHangoutFormContainer: HTMLDivElement = createDivElement(null, 'join-hangout-form-container');
  joinHangoutFormContainer.setAttribute('tabindex', '0');

  const joinHangoutForm: HTMLFormElement = createJoinHangoutForm();
  joinHangoutForm.addEventListener('submit', handleFormSubmission);

  joinHangoutForm.appendChild(createParagraphElement('title', 'Hangout password required.'));
  joinHangoutForm.appendChild(createParagraphElement('description', 'Please contact the hangout leader to request the password.'));
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


function createFormGroup(): HTMLDivElement {
  const formGroup: HTMLDivElement = createDivElement('form-group form-group-password relative');

  const label: HTMLLabelElement = document.createElement('label');
  label.setAttribute('for', 'join-hangout-password-input');
  label.appendChild(document.createTextNode('Hangout password'));

  const passwordInput: HTMLInputElement = document.createElement('input');
  passwordInput.setAttribute('type', 'password');
  passwordInput.id = 'join-hangout-password-input';
  passwordInput.setAttribute('autocomplete', 'new-password');
  passwordInput.addEventListener('input', () => validatePassword(passwordInput));

  const passwordRevealBtn: HTMLButtonElement = createBtnElement('password-icon svg w-2 h-2 group', null);
  passwordRevealBtn.id = 'join-hangout-password-input-reveal-btn';
  passwordRevealBtn.setAttribute('aria-label', 'Reveal guest password');
  passwordRevealBtn.addEventListener('click', () => revealPassword(passwordRevealBtn));
  passwordRevealBtn.appendChild(createPasswordRevealIcon());

  const errorSpan: HTMLSpanElement = createSpanElement('error-span', '');
  errorSpan.setAttribute('data-target', 'join-hangout-password-input');

  formGroup.appendChild(label);
  formGroup.appendChild(passwordInput);
  formGroup.appendChild(passwordRevealBtn);
  formGroup.appendChild(errorSpan);

  return formGroup;
};

function createBtnContainer(): HTMLDivElement {
  const btnContainer: HTMLDivElement = createDivElement('btn-container');

  const submitBtn: HTMLButtonElement = createBtnElement('submit-btn', 'Join hangout');
  submitBtn.setAttribute('type', 'submit');

  const cancelBtn: HTMLButtonElement = createBtnElement('cancel-btn', 'Go to homepage');
  cancelBtn.addEventListener('click', () => window.location.href = 'home');

  btnContainer.appendChild(submitBtn);
  btnContainer.appendChild(cancelBtn);

  return btnContainer;
};

function createPasswordRevealIcon(): SVGSVGElement {
  const passwordRevealSvg: SVGSVGElement = createSvgElement(500, 500);

  const passwordRevealPath: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  passwordRevealPath.setAttribute('class', 'fill-description dark:fill-description-dark group-hover:fill-cta dark:group-hover:fill-cta-dark');
  passwordRevealPath.setAttribute('fill-rule', 'evenodd');
  passwordRevealPath.setAttribute('clip-rule', 'evenodd');
  passwordRevealPath.setAttribute('d', 'M485.416 267.826C450.744 307.575 358.471 400 250.091 400C141.71 400 49.4376 307.575 14.7649 267.826C5.74504 257.485 5.74504 242.515 14.7649 232.174C49.4376 192.425 141.71 100 250.091 100C358.471 100 450.744 192.425 485.416 232.174C494.436 242.515 494.436 257.485 485.416 267.826ZM250.091 326C292.064 326 326.091 291.974 326.091 250C326.091 208.026 292.064 174 250.091 174C243.954 174 237.988 174.727 232.273 176.1C230.721 176.473 230.286 178.459 231.391 179.611C237.342 185.81 241 194.228 241 203.5C241 222.554 225.554 238 206.5 238C196.426 238 187.36 233.682 181.052 226.796C179.974 225.619 177.965 225.924 177.492 227.448C175.281 234.574 174.091 242.148 174.091 250C174.091 291.974 208.117 326 250.091 326ZM250.091 350C305.319 350 350.091 305.228 350.091 250C350.091 194.772 305.319 150 250.091 150C194.862 150 150.091 194.772 150.091 250C150.091 305.228 194.862 350 250.091 350Z');

  passwordRevealSvg.appendChild(passwordRevealPath);
  return passwordRevealSvg;
};