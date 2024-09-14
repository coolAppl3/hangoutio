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
const previousStepBtn: HTMLButtonElement | null = document.querySelector('#hangout-form-prev');
const nextStepBtn: HTMLButtonElement | null = document.querySelector('#hangout-form-next');
const progressBarThumb: HTMLElement | null = document.querySelector('#progress-bar-thumb');

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
    moveBack();
  };

  if (e.target.id === nextStepBtn?.id) {
    moveForward();
  };
};

function moveBack(): void {
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
  updateProgressBase();
};

function moveForward(): void {
  if (formNavigationState.currentStep + 1 > formNavigationState.totalSteps) {
    return;
  };

  const nextForm: HTMLElement | null = document.querySelector(`#hangout-form-step-${formNavigationState.currentStep + 1}`);

  nextForm ? nextForm.style.display = 'block' : undefined;
  hangoutForm ? hangoutForm.style.transform = `translateX(calc(-${formNavigationState.currentStep} * (100% + 40px)))` : undefined;

  formNavigationState.currentStep++;

  displayNavButtons();
  updateProgressBase();
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
    previousStepBtn.style.display = 'block';
    previousStepBtn.removeAttribute('disabled');
  };

  if (formNavigationState.currentStep < formNavigationState.totalSteps) {
    nextStepBtn.style.display = 'block';
    nextStepBtn.removeAttribute('disabled');
  };
};

function updateProgressBase(): void {
  const newWidth: string = ((formNavigationState.currentStep / 3) * 100).toFixed(2);
  progressBarThumb ? progressBarThumb.style.width = `${newWidth}%` : undefined;
};