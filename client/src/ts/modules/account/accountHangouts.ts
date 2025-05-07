import { ACCOUNT_HANGOUT_HISTORY_FETCH_BATCH_SIZE } from "../global/clientConstants";
import { createHangoutElement } from "./accountUtils";
import { accountState } from "./initAccount";

interface AccountHangoutState {
  fetchOffset: number,
  allHangoutsFetched: boolean,
};

const accountHangoutState: AccountHangoutState = {
  fetchOffset: ACCOUNT_HANGOUT_HISTORY_FETCH_BATCH_SIZE,
  allHangoutsFetched: false,
};

const hangoutsElement: HTMLDivElement | null = document.querySelector('#hangouts');
const hangoutsContainer: HTMLDivElement | null = document.querySelector('#hangouts-container');
const loadMoreHangoutsBtn: HTMLButtonElement | null = document.querySelector('#load-more-hangouts-btn');

export function initAccountHangouts(): void {
  loadEventListeners();
  renderAccountHangouts();
};

function loadEventListeners(): void {
  hangoutsElement?.addEventListener('click', handleHangoutsElementClicks);
};

function renderAccountHangouts(): void {
  if (!accountState.data || !hangoutsContainer) {
    return;
  };

  if (accountState.data.hangoutHistory.length % accountHangoutState.fetchOffset !== 0) {
    accountHangoutState.allHangoutsFetched = true;
    loadMoreHangoutsBtn?.classList.add('hidden');
  };

  const fragment: DocumentFragment = new DocumentFragment();

  for (const hangout of accountState.data.hangoutHistory) {
    fragment.appendChild(createHangoutElement(hangout));
  };

  hangoutsContainer.appendChild(fragment);
};

async function handleHangoutsElementClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'load-more-hangouts-btn') {
    if (accountHangoutState.allHangoutsFetched) {
      e.target.classList.add('hidden');
      return;
    };

    await loadMoreHangouts();
  };
};

async function loadMoreHangouts(): Promise<void> {
  // TODO: implement
};