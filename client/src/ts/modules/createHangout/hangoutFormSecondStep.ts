import SliderInput from "../global/SliderInput";
import { hangoutFormState } from "./hangoutFormState";

const memberLimitSlider: SliderInput = new SliderInput('member-limit-input', 'member', 2, 20, 10);
const availabilityStepSlider: SliderInput = new SliderInput('availability-step-input', 'day', 1, 7);
const suggestionsStepSlider: SliderInput = new SliderInput('suggestions-step-input', 'day', 1, 7);
const votingStepSlider: SliderInput = new SliderInput('voting-step-input', 'day', 1, 7);

export function hangoutFormSecondStep(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('member-limit-input_valueChange', () => { hangoutFormState.memberLimit = memberLimitSlider.value });
  document.addEventListener('availability-step-input_valueChange', () => { hangoutFormState.availabilityStep = availabilityStepSlider.value });
  document.addEventListener('suggestions-step-input_valueChange', () => { hangoutFormState.suggestionsStep = suggestionsStepSlider.value });
  document.addEventListener('voting-step-input_valueChange', () => { hangoutFormState.votingStep = votingStepSlider.value });
};