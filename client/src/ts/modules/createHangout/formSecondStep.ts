import SliderInput from "../global/SliderInput";

const availabilityStepSlider = new SliderInput('availability-step-input', 'day', 1, 7);
const suggestionsStepSlider = new SliderInput('suggestions-step-input', 'day', 1, 7);
const votingStepSlider = new SliderInput('voting-step-input', 'day', 1, 7);

export function formSecondStep(): void { };