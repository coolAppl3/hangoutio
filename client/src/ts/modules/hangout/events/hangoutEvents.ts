import axios, { AxiosError } from "../../../../../node_modules/axios/index";
import { handleAuthSessionExpired } from "../../global/authUtils";
import { getDateAndTimeString } from "../../global/dateTimeUtils";
import { createDivElement, createParagraphElement, createSpanElement } from "../../global/domUtils";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import { getHangoutEventsService } from "../../services/hangoutServices";
import { globalHangoutState } from "../globalHangoutState";
import { HangoutEvent } from "../hangoutTypes";

interface HangoutEventsState {
  isLoaded: boolean,
  hangoutEvents: HangoutEvent[],

  eventsRenderLimit: number,
};

const hangoutEventsState: HangoutEventsState = {
  isLoaded: false,
  hangoutEvents: [],

  eventsRenderLimit: 20,
};

const eventsContainer: HTMLDivElement | null = document.querySelector('#events-container');

export function hangoutEvents(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-events', initHangoutEvents);
};

async function initHangoutEvents(): Promise<void> {
  if (hangoutEventsState.isLoaded) {
    renderHangoutEvents();
    return;
  };

  if (!globalHangoutState.data) {
    popup('Failed to load hangout events.', 'error');
    return;
  };

  LoadingModal.display();

  await getHangoutEvents();
  renderHangoutEvents();

  LoadingModal.remove();
};

function renderHangoutEvents(): void {
  if (!eventsContainer) {
    return;
  };

  const innerEventsContainer: HTMLDivElement = createDivElement(null, 'events-container-inner');
  const eventsToRender: number = Math.min(hangoutEventsState.eventsRenderLimit, hangoutEventsState.hangoutEvents.length);

  for (let i = 0; i < eventsToRender; i++) {
    const event: HangoutEvent | undefined = hangoutEventsState.hangoutEvents[i];

    if (!event) {
      return;
    };

    innerEventsContainer.appendChild(createEventElement(event));
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
    hangoutEventsState.isLoaded = true;

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong..', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;

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

function createEventElement(event: HangoutEvent): HTMLDivElement {
  const eventElement: HTMLDivElement = createDivElement('event');

  eventElement.appendChild(createSpanElement('created-on', getDateAndTimeString(event.event_timestamp)));
  eventElement.appendChild(createParagraphElement('description', event.event_description));

  return eventElement;
};