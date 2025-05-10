import { handleAuthSessionExpired } from "../../global/authUtils";
import { getDateAndTimeString } from "../../global/dateTimeUtils";
import { debounce } from "../../global/debounce";
import { createDivElement, createParagraphElement, createSpanElement } from "../../global/domUtils";
import { AsyncErrorData, getAsyncErrorData } from "../../global/errorUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { getHangoutEventsService } from "../../services/hangoutServices";
import { globalHangoutState } from "../globalHangoutState";
import { HangoutEvent } from "../hangoutTypes";

interface HangoutEventsState {
  isLoaded: boolean,

  hangoutEvents: HangoutEvent[],
  filteredHangoutEvents: HangoutEvent[],

  eventsRenderLimit: number,
  membersSectionMutationObserverActive: boolean,
};

export const hangoutEventsState: HangoutEventsState = {
  isLoaded: false,

  hangoutEvents: [],
  filteredHangoutEvents: [],

  eventsRenderLimit: 20,
  membersSectionMutationObserverActive: false,
};

const eventsSection: HTMLElement | null = document.querySelector('#events-section');

const eventsContainer: HTMLDivElement | null = document.querySelector('#events-container');
const eventsSearchInput: HTMLInputElement | null = document.querySelector('#events-search-input');
const renderMoreEventsBtn: HTMLButtonElement | null = document.querySelector('#render-more-events-btn');

export function hangoutEvents(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-events', initHangoutEvents);

  eventsSearchInput?.addEventListener('input', debounceEventSearch);
  renderMoreEventsBtn?.addEventListener('click', renderMoreEvents);
};

async function initHangoutEvents(): Promise<void> {
  if (hangoutEventsState.isLoaded) {
    renderEventsContainer();
    return;
  };

  if (!globalHangoutState.data) {
    popup('Failed to load hangout events.', 'error');
    return;
  };

  LoadingModal.display();

  await getHangoutEvents();
  renderEventsSection();

  LoadingModal.remove();
};

function renderEventsSection(): void {
  renderEventsContainer();

  if (!hangoutEventsState.membersSectionMutationObserverActive) {
    initMembersSectionMutationObserver();
  };
};

function renderEventsContainer(): void {
  if (!eventsContainer) {
    return;
  };

  const innerEventsContainer: HTMLDivElement = createDivElement(null, 'events-container-inner');
  const eventsToRender: number = Math.min(hangoutEventsState.eventsRenderLimit, hangoutEventsState.filteredHangoutEvents.length);

  for (let i = 0; i < eventsToRender; i++) {
    const event: HangoutEvent | undefined = hangoutEventsState.filteredHangoutEvents[i];

    if (!event) {
      return;
    };

    innerEventsContainer.appendChild(createEventElement(event));
  };

  if (hangoutEventsState.filteredHangoutEvents.length === 0) {
    innerEventsContainer.appendChild(createParagraphElement('no-events-found', 'No events found'));
  };

  if (hangoutEventsState.eventsRenderLimit <= hangoutEventsState.filteredHangoutEvents.length) {
    renderMoreEventsBtn?.classList.remove('hidden');

  } else {
    renderMoreEventsBtn?.classList.add('hidden');
  };

  eventsContainer.firstElementChild?.remove();
  eventsContainer.appendChild(innerEventsContainer);
};

async function getHangoutEvents(): Promise<void> {
  if (hangoutEventsState.isLoaded) {
    return;
  };

  if (!globalHangoutState.data) {
    popup('Failed to load hangout events.', 'error');
    return;
  };

  const { hangoutId, hangoutMemberId } = globalHangoutState.data;

  try {
    const hangoutEvents: HangoutEvent[] = (await getHangoutEventsService(hangoutId, hangoutMemberId)).data;

    hangoutEventsState.hangoutEvents = hangoutEvents;
    hangoutEventsState.filteredHangoutEvents = [...hangoutEvents];

    hangoutEventsState.isLoaded = true;

  } catch (err: unknown) {
    console.log(err);

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 401) {
      handleAuthSessionExpired();
      return;
    };

    if (status === 404) {
      setTimeout(() => LoadingModal.display(), 0);
      setTimeout(() => window.location.reload(), 1000);
    };
  };
};

const debounceEventSearch = debounce(searchHangoutEvents, 300);

export function searchHangoutEvents(): void {
  if (!eventsSearchInput) {
    return;
  };

  const searchQuery: string = eventsSearchInput.value;
  hangoutEventsState.filteredHangoutEvents = hangoutEventsState.hangoutEvents.filter((event: HangoutEvent) => event.event_description.toLowerCase().includes(searchQuery.toLowerCase()));

  renderEventsContainer();
};

function initMembersSectionMutationObserver(): void {
  if (!eventsSection) {
    return;
  };

  const mutationObserver: MutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class' && eventsSection.classList.contains('hidden')) {
        hangoutEventsState.filteredHangoutEvents = [...hangoutEventsState.hangoutEvents];
        hangoutEventsState.eventsRenderLimit = 20;
        hangoutEventsState.membersSectionMutationObserverActive = false;
        eventsSearchInput && (eventsSearchInput.value = '');

        mutationObserver.disconnect();
        return;
      };
    };
  });

  mutationObserver.observe(eventsSection, { attributes: true, attributeFilter: ['class'] });
  hangoutEventsState.membersSectionMutationObserverActive = true;
};

function renderMoreEvents(): void {
  hangoutEventsState.eventsRenderLimit += 20;
  renderEventsContainer();
};

export function createEventElement(event: HangoutEvent): HTMLDivElement {
  const eventElement: HTMLDivElement = createDivElement('event');

  eventElement.appendChild(createSpanElement('created-on', getDateAndTimeString(event.event_timestamp)));
  eventElement.appendChild(createParagraphElement('description', event.event_description));

  return eventElement;
};