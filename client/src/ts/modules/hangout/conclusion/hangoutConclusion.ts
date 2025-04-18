import { getDateAndTimeString } from "../../global/dateTimeUtils";
import { createDivElement, createParagraphElement, createSpanElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { globalHangoutState } from "../globalHangoutState";
import { directlyNavigateHangoutSections } from "../hangoutNav";
import { HangoutsDetails, Suggestion } from "../hangoutTypes";
import { hangoutSuggestionState, initHangoutSuggestions } from "../suggestions/hangoutSuggestions";
import { createDetailsElement } from "../suggestions/suggestionsUtils";

interface HangoutConclusionState {
  isLoaded: boolean,

  isFailedConclusion: boolean,
  isSingleSuggestionConclusion: boolean,
  tieDetected: boolean,

  winningSuggestions: Suggestion[],
};

const hangoutConclusionState: HangoutConclusionState = {
  isLoaded: false,

  isFailedConclusion: false,
  isSingleSuggestionConclusion: false,
  tieDetected: false,

  winningSuggestions: [],
};

export function hangoutConclusion(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-conclusion', async () => {
    if (!hangoutSuggestionState.isLoaded) {
      await initHangoutSuggestions();
    };

    initHangoutConclusion();
  });
};

function initHangoutConclusion(): void {
  if (hangoutConclusionState.isLoaded) {
    return;
  };

  LoadingModal.display();

  if (!globalHangoutState.data) {
    popup('Failed to load hangout conclusion.', 'error');
    LoadingModal.remove();

    return;
  };

  const hangoutDetails: HangoutsDetails = globalHangoutState.data.hangoutDetails;

  if (!hangoutDetails.is_concluded) {
    popup(`Hangout hasn't been concluded yet.`, 'error');
    directlyNavigateHangoutSections('dashboard');

    LoadingModal.remove();
    return;
  };

  setConclusionDetails();
  renderConclusionSection();

  hangoutConclusionState.isLoaded = true;
  LoadingModal.remove();
};

function setConclusionDetails(): void {
  const hangoutSuggestions: Suggestion[] = hangoutSuggestionState.suggestions;

  if (hangoutSuggestions.length === 0) {
    hangoutConclusionState.isFailedConclusion = true;
    return;
  };

  if (hangoutSuggestions.length === 1) {
    hangoutConclusionState.isSingleSuggestionConclusion = true;
    hangoutConclusionState.winningSuggestions.push(hangoutSuggestions[0]!);

    return;
  };

  setWinningSuggestions(hangoutSuggestions);
};

function setWinningSuggestions(hangoutSuggestions: Suggestion[]): void {
  let winningSuggestion: Suggestion = hangoutSuggestions[0]!; // guaranteed not undefined based on where it's called
  let highestVotesCount: number = winningSuggestion.votes_count;

  hangoutConclusionState.winningSuggestions.push(winningSuggestion);

  for (const suggestion of hangoutSuggestions) {
    if (suggestion.suggestion_id === winningSuggestion.suggestion_id) {
      continue;
    };

    if (suggestion.votes_count < highestVotesCount) {
      continue;
    };

    if (suggestion.votes_count === highestVotesCount) {
      hangoutConclusionState.winningSuggestions.push(suggestion);
      continue;
    };

    hangoutConclusionState.winningSuggestions = [suggestion];
    highestVotesCount = suggestion.votes_count;
  };

  hangoutConclusionState.tieDetected = hangoutConclusionState.winningSuggestions.length > 1;
};

function renderConclusionSection(): void {
  const conclusionElement: HTMLDivElement | null = document.querySelector('#conclusion');

  if (!conclusionElement) {
    LoadingModal.display();
    popup('Failed to load hangout conclusion.', 'error');

    setTimeout(() => {
      directlyNavigateHangoutSections('dashboard');
      LoadingModal.remove();
    }, 100);

    return;
  };

  const conclusionContainer: HTMLDivElement = createDivElement(null, 'conclusion-container');

  conclusionContainer.appendChild(createConclusionContainerHeader());
  hangoutConclusionState.isFailedConclusion || conclusionContainer.appendChild(createInnerConclusionContainer());

  conclusionElement.firstElementChild?.remove();
  conclusionElement.appendChild(conclusionContainer);
};

function createConclusionContainerHeader(): HTMLDivElement {
  const { isFailedConclusion, isSingleSuggestionConclusion, tieDetected } = hangoutConclusionState;
  const conclusionContainerHeader: HTMLDivElement = createDivElement(null, 'conclusion-container-header');

  if (isFailedConclusion) {
    conclusionContainerHeader.appendChild(createParagraphElement('title', 'Hangout conclusion failed.'));
    conclusionContainerHeader.appendChild(createParagraphElement('description', 'Hangout reached the voting stage without any suggestions, leading to a failed conclusion.\n\nYou can always create a new one and try again.'));

    return conclusionContainerHeader;
  };

  if (isSingleSuggestionConclusion) {
    conclusionContainerHeader.appendChild(createParagraphElement('title', 'Hangout has been successfully concluded.'));
    conclusionContainerHeader.appendChild(createParagraphElement('description', 'The hangout reached the voting stage with a single suggestion, marking it as the winning suggestion.'));

    return conclusionContainerHeader;
  };

  conclusionContainerHeader.appendChild(createParagraphElement('title', hangoutConclusionState.tieDetected ? 'Hangout concluded with a tie.' : 'Hangout has been successfully concluded.'));
  conclusionContainerHeader.appendChild(createConclusionDescription(tieDetected));

  return conclusionContainerHeader;
};

function createConclusionDescription(tieDetected: boolean): HTMLParagraphElement {
  const suggestionsCount: number = hangoutSuggestionState.suggestions.length;
  const votesCount: number = hangoutSuggestionState.suggestions.reduce((acc: number, curr: Suggestion) => acc + curr.votes_count, 0);

  if (!tieDetected) {
    return createParagraphElement('description', `A total of ${suggestionsCount} suggestions and ${votesCount} ${votesCount === 1 ? 'vote' : 'votes'} resulted in a winning suggestion.`);
  };

  return createParagraphElement('description', `A total of ${suggestionsCount} suggestions and ${votesCount} ${votesCount === 1 ? 'vote' : 'votes'} resulted in a tie between ${hangoutConclusionState.winningSuggestions.length} suggestions.`);
};

function createInnerConclusionContainer(): HTMLDivElement {
  const innerConclusionContainer: HTMLDivElement = createDivElement(null, 'conclusion-container-inner');

  if (hangoutConclusionState.winningSuggestions.length === 0) {
    innerConclusionContainer.appendChild(createFailedConclusionElement());
    return innerConclusionContainer;
  };

  for (const suggestion of hangoutConclusionState.winningSuggestions) {
    innerConclusionContainer.appendChild(createConclusionSuggestionElement(suggestion));
  };

  return innerConclusionContainer;
};

function createConclusionSuggestionElement(suggestion: Suggestion): HTMLDivElement {
  const conclusionSuggestionElement: HTMLDivElement = createDivElement('conclusion-suggestion');

  conclusionSuggestionElement.appendChild(createParagraphElement('conclusion-suggestion-title', suggestion.suggestion_title));
  conclusionSuggestionElement.appendChild(createConclusionDetailsContainer(suggestion));
  conclusionSuggestionElement.appendChild(createSpanElement('conclusion-suggestion-description-span', 'Suggestion details'));
  conclusionSuggestionElement.appendChild(createParagraphElement('conclusion-suggestion-description', suggestion.suggestion_description));

  return conclusionSuggestionElement;
};

function createConclusionDetailsContainer(suggestion: Suggestion): HTMLDivElement {
  const conclusionDetailsContainer: HTMLDivElement = createDivElement('conclusion-suggestion-details');

  conclusionDetailsContainer.appendChild(createDetailsElement('Start', getDateAndTimeString(suggestion.suggestion_start_timestamp)));
  conclusionDetailsContainer.appendChild(createDetailsElement('End', getDateAndTimeString(suggestion.suggestion_end_timestamp)));
  conclusionDetailsContainer.appendChild(createDetailsElement('Suggested by', getSuggestionDisplayName(suggestion.hangout_member_id)));
  conclusionDetailsContainer.appendChild(createDetailsElement('Votes', `${suggestion.votes_count}`));

  return conclusionDetailsContainer;
};

function createFailedConclusionElement(): HTMLDivElement {
  return createDivElement('hidden');
};

function getSuggestionDisplayName(hangoutMemberId: number | null): string {
  if (!hangoutMemberId) {
    return 'Former member';
  };

  return globalHangoutState.data?.hangoutMembersMap.get(hangoutMemberId) || 'Former member';
};