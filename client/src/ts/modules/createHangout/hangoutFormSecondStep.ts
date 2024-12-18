import { MAX_HANGOUT_MEMBERS_LIMIT, MAX_HANGOUT_PERIOD_DAYS, MIN_HANGOUT_MEMBERS_LIMIT, MIN_HANGOUT_PERIOD_DAYS } from "../global/clientConstants";
import SliderInput from "../global/SliderInput";
import { hangoutFormState } from "./hangoutFormState";

const membersLimitSlider: SliderInput = new SliderInput(
  'member-limit-input',
  'member',
  MIN_HANGOUT_MEMBERS_LIMIT,
  MAX_HANGOUT_MEMBERS_LIMIT,
  10
);

const availabilityPeriodDaysSlider: SliderInput = new SliderInput(
  'availability-step-input',
  'day',
  MIN_HANGOUT_PERIOD_DAYS,
  MAX_HANGOUT_PERIOD_DAYS
);

const suggestionsPeriodDaysSlider: SliderInput = new SliderInput(
  'suggestions-step-input',
  'day',
  MIN_HANGOUT_PERIOD_DAYS,
  MAX_HANGOUT_PERIOD_DAYS
);

const votingPeriodDaysSlider: SliderInput = new SliderInput(
  'voting-step-input',
  'day',
  MIN_HANGOUT_PERIOD_DAYS,
  MAX_HANGOUT_PERIOD_DAYS
);

export function hangoutFormSecondStep(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('member-limit-input_valueChange', () => { hangoutFormState.membersLimit = membersLimitSlider.value });

  document.addEventListener('availability-step-input_valueChange', () => { hangoutFormState.availabilityPeriodDays = availabilityPeriodDaysSlider.value });

  document.addEventListener('suggestions-step-input_valueChange', () => { hangoutFormState.suggestionsPeriodDays = suggestionsPeriodDaysSlider.value });

  document.addEventListener('voting-step-input_valueChange', () => { hangoutFormState.votingPeriodDays = votingPeriodDaysSlider.value });
};