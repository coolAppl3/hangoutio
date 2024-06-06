import { hangoutFormState } from "./hangoutFormState";

import { setSliderValues } from "./hangoutFormConfig";
import hangoutAvailability from "./hangoutAvailability";
import hangoutAccount from "./hangoutAccount";
import popup from "../global/popup";

// initializing imports
hangoutAvailability();
hangoutAccount();


interface FormStepState {
  currentStep: number,
  totalSteps: number,
};

const formStepState: FormStepState = {
  currentStep: 1,
  totalSteps: 3,
};

export default function hangoutForms(): void {
  loadEventListeners();
  render();
};

function loadEventListeners(): void {
  const formNavigation: HTMLElement | null = document.querySelector('#form-navigation');
  formNavigation?.addEventListener('click', handleNavigation);

  window.addEventListener('accountDetailsValid', handleFormSubmission);
  window.addEventListener('timeSlotsChanged', handleStepValidation);
};

function render(): void {
  updateNavigationButtons();
  updateProgressBar();
  handleStepValidation();
};

// submission
function handleFormSubmission(): void {
  if (hangoutFormState.timeSlots.length === 0 || hangoutFormState.dateTimestamp === 0) {
    popup('You must add your availability before continuing.', 'error');
    regressStep();

    return;
  };

  console.log('Form submission')
};

// validation
function handleStepValidation(): void {
  if (formStepState.currentStep === 2 && (hangoutFormState.timeSlots.length === 0 || hangoutFormState.dateTimestamp === 0)) {
    disableNextStepBtn();
    return;
  };

  enableNextStepBtn();
};

// navigation
function handleNavigation(e: MouseEvent): void {
  if (e?.target instanceof HTMLElement === false) {
    return;
  };

  const targetElementID: string = e.target.id;

  if (targetElementID === 'previous-step-btn' && (formStepState.currentStep - 1) >= 1) {
    regressStep();
    return;
  };

  if (targetElementID === 'next-step-btn' && (formStepState.currentStep + 1) <= formStepState.totalSteps) {
    progressStep();
  };
};

function progressStep(): void {
  const currentStepElement: HTMLElement | null = document.querySelector(`#step-${formStepState.currentStep}`);

  if (formStepState.currentStep === 1) {
    setSliderValues();
  };

  formStepState.currentStep++;
  render();

  currentStepElement?.classList.add('animating', 'completed');
  setTimeout(() => { currentStepElement?.classList.remove('animating') }, 100);
  currentStepElement?.classList.remove('current', 'in-position');

  currentStepElement?.nextElementSibling?.classList.add('current');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      currentStepElement?.nextElementSibling?.classList.add('in-position');
    });
  });
};

function regressStep(): void {
  const currentStepElement: HTMLElement | null = document.querySelector(`#step-${formStepState.currentStep}`);
  formStepState.currentStep--;
  render();

  currentStepElement?.classList.remove('in-position', 'current');
  currentStepElement?.previousElementSibling?.classList.add('current');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      currentStepElement?.previousElementSibling?.classList.replace('completed', 'in-position');
    });
  });
};

// utility
function updateNavigationButtons(): void {
  const previousStepBtn: HTMLButtonElement | null = document.querySelector('#previous-step-btn');
  const nextStepBtn: HTMLButtonElement | null = document.querySelector('#next-step-btn');

  if (!previousStepBtn || !nextStepBtn) {
    return;
  };

  previousStepBtn.style.display = 'flex';
  previousStepBtn.removeAttribute('disabled');

  nextStepBtn.style.display = 'block';
  nextStepBtn.removeAttribute('disabled');

  if (formStepState.currentStep === 1) {
    previousStepBtn.style.display = 'none';
    previousStepBtn.setAttribute('disabled', '');
  };

  if (formStepState.currentStep === formStepState.totalSteps) {
    nextStepBtn.style.display = 'none';
    nextStepBtn.setAttribute('disabled', '');
  };
};

function updateProgressBar(): void {
  const progressContainerStep: HTMLSpanElement | null = document.querySelector('#progress-container-step');
  progressContainerStep ? progressContainerStep.textContent = `${formStepState.currentStep}` : undefined;

  const completionPercentage = ((formStepState.currentStep - 1) / formStepState.totalSteps) * 100
  const roundedCompletionPercentage: number = Math.round(completionPercentage);

  const progressBar: HTMLDivElement | null = document.querySelector('#progress-bar');
  progressBar ? progressBar.style.width = `${roundedCompletionPercentage}%` : undefined;
};

function disableNextStepBtn(): void {
  const nextStepBtn: HTMLButtonElement | null = document.querySelector('#next-step-btn');

  if (!nextStepBtn) {
    return;
  };

  nextStepBtn.classList.add('disabled');
  nextStepBtn.setAttribute('disabled', '');
  nextStepBtn.setAttribute('title', 'You must add your availability before continuing.');
};

function enableNextStepBtn(): void {
  const nextStepBtn: HTMLButtonElement | null = document.querySelector('#next-step-btn');

  if (!nextStepBtn) {
    return;
  };

  nextStepBtn.classList.remove('disabled');
  nextStepBtn.removeAttribute('disabled');
  nextStepBtn.removeAttribute('title');
};