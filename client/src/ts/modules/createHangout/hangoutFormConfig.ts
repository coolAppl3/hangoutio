import { hangoutFormState } from "./hangoutFormState";
import SliderInput from "../global/SliderInput";

// initializing imports
const availabilitySlider: SliderInput = new SliderInput('availability-period', 1, 7);
const suggestionsPeriodSlider: SliderInput = new SliderInput('suggestions-period', 1, 14);
const votingPeriodSlider: SliderInput = new SliderInput('voting-period', 1, 14);

export function setSliderValues(): void {
  hangoutFormState.availabilityPeriod = availabilitySlider.value;
  hangoutFormState.suggestionsPeriod = suggestionsPeriodSlider.value;
  hangoutFormState.votingPeriod = votingPeriodSlider.value;
};