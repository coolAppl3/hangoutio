import SliderInput from "../global/SliderInput";
import { formState } from "./formState";

const memberLimitSlider: SliderInput = new SliderInput('member-limit-input', 'member', 2, 20, 10);
const availabilityStepSlider: SliderInput = new SliderInput('availability-step-input', 'day', 1, 7);
const suggestionsStepSlider: SliderInput = new SliderInput('suggestions-step-input', 'day', 1, 7);
const votingStepSlider: SliderInput = new SliderInput('voting-step-input', 'day', 1, 7);

export function formSecondStep(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('member-limit-input_valueChange', () => { formState.memberLimit = memberLimitSlider.value });
  document.addEventListener('availability-step-input_valueChange', () => { formState.availabilityStep = availabilityStepSlider.value });
  document.addEventListener('suggestions-step-input_valueChange', () => { formState.suggestionsStep = suggestionsStepSlider.value });
  document.addEventListener('voting-step-input_valueChange', () => { formState.votingStep = votingStepSlider.value });
};