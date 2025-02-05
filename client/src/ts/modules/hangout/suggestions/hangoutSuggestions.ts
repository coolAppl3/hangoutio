import { hangoutAvailabilityState, initHangoutAvailability } from "../availability/hangoutAvailability";
import { Suggestion } from "../hangoutTypes";
import { initHangoutSuggestionsForm } from "./hangoutSuggestionsForm";

interface HangoutSuggestionsState {
  suggestions: Suggestion[],
};

export const hangoutSuggestionState: HangoutSuggestionsState = {
  suggestions: [],
};



export function hangoutSuggestions(): void {
  loadEventListeners();
};

async function initHangoutSuggestions(): Promise<void> {
  initHangoutSuggestionsForm();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-suggestions', async () => {
    if (!hangoutAvailabilityState.isLoaded) {
      await initHangoutAvailability();
    };

    initHangoutSuggestions();
  });
};