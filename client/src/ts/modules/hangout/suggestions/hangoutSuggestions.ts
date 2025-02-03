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

async function init(): Promise<void> {
  initHangoutSuggestionsForm();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-suggestions', init);
};