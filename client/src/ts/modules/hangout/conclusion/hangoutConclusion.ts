import { getDateAndTimeString } from "../../global/dateTimeUtils";
import { createDivElement, createParagraphElement, createSpanElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { globalHangoutState } from "../globalHangoutState";
import { directlyNavigateHangoutSections } from "../hangoutNav";
import { HangoutsDetails, Suggestion } from "../hangoutTypes";
import { hangoutSuggestionState, initHangoutSuggestions } from "../suggestions/hangoutSuggestions";

interface HangoutConclusionState {
  isLoaded: boolean,

  isFailedConclusion: boolean,
  isSingleSuggestionConclusion: boolean,

  tieDetected: boolean,
  tiedSuggestionsCount: number,

  winningSuggestion: Suggestion | null,
};

const hangoutConclusionState: HangoutConclusionState = {
  isLoaded: false,

  isFailedConclusion: false,
  isSingleSuggestionConclusion: false,

  tieDetected: false,
  tiedSuggestionsCount: 0,

  winningSuggestion: null,
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
    hangoutConclusionState.winningSuggestion = hangoutSuggestions[0]!;

    return;
  };

  hangoutConclusionState.winningSuggestion = getWinningSuggestion(hangoutSuggestions);
};

function getWinningSuggestion(hangoutSuggestions: Suggestion[]): Suggestion {
  let winningSuggestion: Suggestion = hangoutSuggestions[0]!; // guaranteed to not be undefined based on where the function is called
  let highestVotesCount: number = winningSuggestion.votes_count;

  hangoutConclusionState.tiedSuggestionsCount = 1;

  for (const suggestion of hangoutSuggestions) {
    if (suggestion.suggestion_id === winningSuggestion.suggestion_id || suggestion.votes_count < highestVotesCount) {
      continue;
    };

    if (suggestion.votes_count === highestVotesCount && suggestion.suggestion_id !== hangoutSuggestions[0]?.suggestion_id) {
      hangoutConclusionState.tieDetected = true;
      hangoutConclusionState.tiedSuggestionsCount++;
      continue;
    };

    winningSuggestion = suggestion;
    highestVotesCount = suggestion.votes_count;

    hangoutConclusionState.tieDetected = false;
    hangoutConclusionState.tiedSuggestionsCount = 0;
  };

  if (!hangoutConclusionState.tieDetected) {
    return winningSuggestion;
  };

  const tiedSuggestions: Suggestion[] = hangoutSuggestions.filter((suggestion: Suggestion) => suggestion.votes_count === highestVotesCount);
  const randomWinningSuggestionIndex = Math.floor(Math.random() * tiedSuggestions.length);

  winningSuggestion = tiedSuggestions[randomWinningSuggestionIndex]!;
  return winningSuggestion;
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
    conclusionContainerHeader.appendChild(createParagraphElement('description', 'The suggestions stage ended without any suggestions being made, leading to the hangout concluding without a winning suggestion. You can always create a new one and try again.'));

    return conclusionContainerHeader;
  };

  if (isSingleSuggestionConclusion) {
    conclusionContainerHeader.appendChild(createParagraphElement('title', 'Hangout has been successfully concluded.'));
    conclusionContainerHeader.appendChild(createParagraphElement('description', 'The hangout reached the voting stage with a single suggestion, marking it as the winning suggestion without any votes.'));

    return conclusionContainerHeader;
  };


  conclusionContainerHeader.appendChild(createParagraphElement('title', 'Hangout has been successfully concluded.'));
  conclusionContainerHeader.appendChild(createConclusionDescription(tieDetected));

  return conclusionContainerHeader;
};

function createConclusionDescription(tieDetected: boolean): HTMLParagraphElement {
  const suggestionsCount: number = hangoutSuggestionState.suggestions.length;
  const votesCount: number = hangoutSuggestionState.suggestions.reduce((acc: number, curr: Suggestion) => acc + curr.votes_count, 0);

  if (!tieDetected) {
    return createParagraphElement('description', `A total of ${suggestionsCount} suggestions and ${votesCount} ${votesCount === 1 ? 'vote' : 'votes'} resulted in a winning suggestion.`);
  };

  return createParagraphElement('description', `A total of ${suggestionsCount} suggestions and ${votesCount} ${votesCount === 1 ? 'vote' : 'votes'} resulted in a tie between ${hangoutConclusionState.tiedSuggestionsCount} suggestions. One of them was randomly chosen as the winning suggestion.`);
};

function createInnerConclusionContainer(): HTMLDivElement {
  const innerConclusionContainer: HTMLDivElement = createDivElement(null, 'conclusion-container-inner');
  const winningSuggestion: Suggestion | null = hangoutConclusionState.winningSuggestion;

  if (!winningSuggestion) {
    innerConclusionContainer.appendChild(createFailedConclusionElement());
    return innerConclusionContainer;
  };

  innerConclusionContainer.appendChild(createParagraphElement('conclusion-title', winningSuggestion.suggestion_title));
  innerConclusionContainer.appendChild(createConclusionDetailsContainer(winningSuggestion));
  innerConclusionContainer.appendChild(createSpanElement('conclusion-description-span', 'Suggestion details'));
  innerConclusionContainer.appendChild(createParagraphElement('conclusion-description', winningSuggestion.suggestion_description));

  return innerConclusionContainer;
};

function createConclusionDetailsContainer(suggestion: Suggestion): HTMLDivElement {
  const conclusionDetailsContainer: HTMLDivElement = createDivElement('conclusion-details');

  conclusionDetailsContainer.appendChild(createDetailsElement('start', getDateAndTimeString(suggestion.suggestion_start_timestamp)));
  conclusionDetailsContainer.appendChild(createDetailsElement('End', getDateAndTimeString(suggestion.suggestion_end_timestamp)));
  conclusionDetailsContainer.appendChild(createDetailsElement('Votes', `${suggestion.votes_count}`));
  conclusionDetailsContainer.appendChild(createDetailsElement('Likes', `${suggestion.likes_count}`));

  return conclusionDetailsContainer;
};

function createDetailsElement(title: string, value: string): HTMLDivElement {
  const detailsElement: HTMLDivElement = createDivElement(null);

  detailsElement.appendChild(createSpanElement(null, title));
  detailsElement.appendChild(createSpanElement(null, value));

  return detailsElement;
};

function createFailedConclusionElement(): HTMLDivElement {
  return createDivElement('test');
};