import revealPassword from "../global/revealPassword";

interface Member {
  name: string;
  password: string;
};

interface FormState {
  currentStep: number,
  totalSteps: number,
  leaderName?: string,
  leaderUsername?: string,
  leaderPassword?: string,
  members: Member[],
};

const formState: FormState = {
  currentStep: 1,
  totalSteps: 5,
  leaderName: undefined,
  leaderPassword: undefined,
  members: [],
};

export default function hangoutForms(): void {
  loadEventListeners();
  render();
};

function loadEventListeners(): void {
  const accountPasswordIcon: HTMLElement | null = document.querySelector('#password-icon-account');
  accountPasswordIcon?.addEventListener('click', () => { revealPassword(accountPasswordIcon) });

  const formNavigation: HTMLElement | null = document.querySelector('#form-navigation');
  formNavigation?.addEventListener('click', handleNavigation);

  const stepsForm: HTMLFormElement | null = document.querySelector('#steps-form');
  stepsForm?.addEventListener('submit', handleFormSubmission);
};

function render(): void {
  updateNavigationButtons();
  updateProgressBar();
};

function handleNavigation(e: MouseEvent): void {
  if (e?.target instanceof HTMLElement === false) {
    return;
  };

  const targetElementID: string = e.target.id;

  if (targetElementID === 'previous-step-btn' && (formState.currentStep - 1) >= 1) {
    regressStep();
    return;
  };

  if (targetElementID === 'next-step-btn' && (formState.currentStep + 1) <= formState.totalSteps) {
    progressStep();
  };
};

function progressStep(): void {
  const currentStepElement: HTMLElement | null = document.querySelector(`#step-${formState.currentStep}`);
  formState.currentStep++;
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
  const currentStepElement: HTMLElement | null = document.querySelector(`#step-${formState.currentStep}`);
  formState.currentStep--;
  render();

  currentStepElement?.classList.remove('in-position', 'current');
  currentStepElement?.previousElementSibling?.classList.add('current');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      currentStepElement?.previousElementSibling?.classList.replace('completed', 'in-position');
    });
  });
};

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

  if (formState.currentStep === 1) {
    previousStepBtn.style.display = 'none';
    previousStepBtn.setAttribute('disabled', 'disabled');
  };

  if (formState.currentStep === formState.totalSteps) {
    nextStepBtn.style.display = 'none';
    nextStepBtn.setAttribute('disabled', 'disabled');
  };
};

function updateProgressBar(): void {
  const progressContainerStep: HTMLSpanElement | null = document.querySelector('#progress-container-step');
  progressContainerStep ? progressContainerStep.textContent = `${formState.currentStep}` : undefined;

  const completionPercentage = ((formState.currentStep - 1) / formState.totalSteps) * 100
  const roundedCompletionPercentage: number = Math.round(completionPercentage);

  const progressBar: HTMLDivElement | null = document.querySelector('#progress-bar');
  progressBar ? progressBar.style.width = `${roundedCompletionPercentage}%` : undefined;
};

function handleFormSubmission(e: SubmitEvent): void {
  e.preventDefault();

  if (formState.currentStep !== formState.totalSteps) {
    progressStep();
    return;
  };

  console.log('Form submission');
  // to be further implemented later...
};