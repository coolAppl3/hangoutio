import ErrorSpan from "../global/ErrorSpan";
import { isValidFormFirstStepDetails } from "./hangoutFormFirstStep";

interface HangoutFormNavigationState {
  currentStep: number,
  totalSteps: number,
};

export const hangoutFormNavigationState: HangoutFormNavigationState = {
  currentStep: 1,
  totalSteps: 3,
};

const hangoutForm: HTMLDivElement | null = document.querySelector('#hangout-form');
const hangoutFormNav: HTMLDivElement | null = document.querySelector('#hangout-form-nav');
const previousStepBtn: HTMLButtonElement | null = document.querySelector('#hangout-form-prev-btn');
const nextStepBtn: HTMLButtonElement | null = document.querySelector('#hangout-form-next-btn');

const progressBarThumb: HTMLElement | null = document.querySelector('#progress-bar-thumb');
const progressNumber: HTMLSpanElement | null = document.querySelector('#progress-number');

export function hangoutFormNavigation(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('DOMContentLoaded', displayNavButtons);
  hangoutFormNav?.addEventListener('click', navigateHangoutForm);
};

function navigateHangoutForm(e: MouseEvent): void {
  if (!(e.target instanceof HTMLElement)) {
    return;
  };

  if (e.target.id === previousStepBtn?.id) {
    moveBackwards();
  };

  if (e.target.id === nextStepBtn?.id) {
    moveForwards();
  };
};

function moveBackwards(): void {
  if (hangoutFormNavigationState.currentStep === 1) {
    return;
  };

  const currentForm: HTMLElement | null = document.querySelector(`#hangout-form-step-${hangoutFormNavigationState.currentStep}`);

  const previousForm: HTMLElement | null = document.querySelector(`#hangout-form-step-${hangoutFormNavigationState.currentStep - 1}`);
  previousForm ? previousForm.style.height = 'auto' : undefined;

  hangoutForm ? hangoutForm.style.transform = `translateX(calc(-${hangoutFormNavigationState.currentStep - 2} * (100% + 40px)))` : undefined;
  currentForm ? currentForm.style.display = 'none' : undefined;

  hangoutFormNavigationState.currentStep--;

  displayNavButtons();
  updateProgressBar();
  triggerDOMRectUpdateEvent();
};

function moveForwards(): void {
  if (hangoutFormNavigationState.currentStep + 1 > hangoutFormNavigationState.totalSteps) {
    return;
  };

  if (hangoutFormNavigationState.currentStep === 1) {
    if (!isValidFormFirstStepDetails()) {
      return;
    };
  };

  const currentForm: HTMLElement | null = document.querySelector(`#hangout-form-step-${hangoutFormNavigationState.currentStep}`);
  const nextForm: HTMLElement | null = document.querySelector(`#hangout-form-step-${hangoutFormNavigationState.currentStep + 1}`);

  nextForm ? nextForm.style.display = 'block' : undefined;
  hangoutForm ? hangoutForm.style.transform = `translateX(calc(-${hangoutFormNavigationState.currentStep} * (100% + 40px)))` : undefined;

  currentForm ? currentForm.style.height = '0px' : undefined;

  hangoutFormNavigationState.currentStep++;

  displayNavButtons();
  updateProgressBar();
  triggerDOMRectUpdateEvent();
};

function displayNavButtons(): void {
  if (!previousStepBtn || !nextStepBtn) {
    return;
  };

  previousStepBtn.style.display = 'none';
  previousStepBtn.setAttribute('disabled', '');

  nextStepBtn.style.display = 'none';
  nextStepBtn.setAttribute('disabled', '');

  if (hangoutFormNavigationState.currentStep > 1) {
    previousStepBtn.style.display = 'flex';
    previousStepBtn.removeAttribute('disabled');
  };

  if (hangoutFormNavigationState.currentStep < hangoutFormNavigationState.totalSteps) {
    nextStepBtn.style.display = 'block';
    nextStepBtn.removeAttribute('disabled');
  };
};

function updateProgressBar(): void {
  const newWidth: string = ((hangoutFormNavigationState.currentStep / 3) * 100).toFixed(2);
  progressBarThumb ? progressBarThumb.style.width = `${newWidth}%` : undefined;

  progressNumber ? progressNumber.innerText = `${hangoutFormNavigationState.currentStep}` : undefined;
};

function triggerDOMRectUpdateEvent(): void {
  document.dispatchEvent(new CustomEvent('updateDOMRect'));
};

export function displayFirstStepError(errMessage: string, inputType: 'title' | 'password'): void {
  moveBackwards();
  moveBackwards();

  const input: HTMLInputElement | null = document.querySelector(`#hangout-${inputType}-input`);
  input ? ErrorSpan.display(input, errMessage) : undefined;
};