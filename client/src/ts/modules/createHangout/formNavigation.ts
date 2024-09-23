import popup from "../global/popup";
import { isValidFormFirstStepDetails } from "./formFirstStep";
import { formState } from "./formState";

interface FormNavigationState {
  currentStep: number,
  totalSteps: number,
};

const formNavigationState: FormNavigationState = {
  currentStep: 1,
  totalSteps: 3,
};

const hangoutForm: HTMLDivElement | null = document.querySelector('#hangout-form');
const hangoutFormNav: HTMLDivElement | null = document.querySelector('#hangout-form-nav');
const previousStepBtn: HTMLButtonElement | null = document.querySelector('#hangout-form-prev-btn');
const nextStepBtn: HTMLButtonElement | null = document.querySelector('#hangout-form-next-btn');

const progressBarThumb: HTMLElement | null = document.querySelector('#progress-bar-thumb');
const progressNumber: HTMLSpanElement | null = document.querySelector('#progress-number');

export function formNavigation(): void {
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
  if (formNavigationState.currentStep === 1) {
    return;
  };

  const currentForm: HTMLElement | null = document.querySelector(`#hangout-form-step-${formNavigationState.currentStep}`);
  const previousForm: HTMLElement | null = document.querySelector(`#hangout-form-step-${formNavigationState.currentStep - 1}`);

  previousForm ? previousForm.style.display = 'block' : undefined;
  hangoutForm ? hangoutForm.style.transform = `translateX(calc(-${formNavigationState.currentStep - 2} * (100% + 40px)))` : undefined;

  currentForm ? currentForm.style.display = 'none' : undefined;

  formNavigationState.currentStep--;

  displayNavButtons();
  updateProgressBar();
  triggerDOMRectUpdateEvent();
};

function moveForwards(): void {
  if (formNavigationState.currentStep + 1 > formNavigationState.totalSteps) {
    return;
  };

  if (formNavigationState.currentStep === 1) {
    if (!isValidFormFirstStepDetails()) {
      return;
    };
  };

  const nextForm: HTMLElement | null = document.querySelector(`#hangout-form-step-${formNavigationState.currentStep + 1}`);

  nextForm ? nextForm.style.display = 'block' : undefined;
  hangoutForm ? hangoutForm.style.transform = `translateX(calc(-${formNavigationState.currentStep} * (100% + 40px)))` : undefined;

  formNavigationState.currentStep++;

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

  if (formNavigationState.currentStep > 1) {
    previousStepBtn.style.display = 'flex';
    previousStepBtn.removeAttribute('disabled');
  };

  if (formNavigationState.currentStep < formNavigationState.totalSteps) {
    nextStepBtn.style.display = 'block';
    nextStepBtn.removeAttribute('disabled');
  };
};

function updateProgressBar(): void {
  const newWidth: string = ((formNavigationState.currentStep / 3) * 100).toFixed(2);
  progressBarThumb ? progressBarThumb.style.width = `${newWidth}%` : undefined;

  progressNumber ? progressNumber.innerText = `${formNavigationState.currentStep}` : undefined;
};

function triggerDOMRectUpdateEvent(): void {
  document.dispatchEvent(new CustomEvent('updateDOMRect'));
};