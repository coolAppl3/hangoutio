import SliderInput from "../global/SliderInput";
import { hangoutFormState } from "./hangoutFormState";

const membersLimitSlider: SliderInput = new SliderInput('member-limit-input', 'member', 2, 20, 10);
const availabilityPeriodDaysSlider: SliderInput = new SliderInput('availability-step-input', 'day', 1, 7);
const suggestionsPeriodDaysSlider: SliderInput = new SliderInput('suggestions-step-input', 'day', 1, 7);
const votingPeriodDaysSlider: SliderInput = new SliderInput('voting-step-input', 'day', 1, 7);

export function hangoutFormSecondStep(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('member-limit-input_valueChange', () => { hangoutFormState.membersLimit = membersLimitSlider.value });
  document.addEventListener('availability-step-input_valueChange', () => { hangoutFormState.availabilityPeriodDays = availabilityPeriodDaysSlider.value });
  document.addEventListener('suggestions-step-input_valueChange', () => { hangoutFormState.suggestionsPeriodDays = suggestionsPeriodDaysSlider.value });
  document.addEventListener('voting-step-input_valueChange', () => { hangoutFormState.votingPeriodDays = votingPeriodDaysSlider.value });
};