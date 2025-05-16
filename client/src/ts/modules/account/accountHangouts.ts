import { handleAuthSessionExpired } from "../global/authUtils";
import { ACCOUNT_HANGOUT_HISTORY_FETCH_BATCH_SIZE } from "../global/clientConstants";
import { ConfirmModal } from "../global/ConfirmModal";
import { createSpanElement } from "../global/domUtils";
import { AsyncErrorData, getAsyncErrorData } from "../global/errorUtils";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { accountLeaveHangoutService, loadMoreHangoutsService } from "../services/accountServices";
import { Hangout } from "./accountTypes";
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
  if (!accountState.data) {
    return;
  };

  loadEventListeners();
  checkForHangoutsHref();

  if (accountState.data.hangoutHistory.length === 0) {
    accountHangoutState.allHangoutsFetched = true;
    loadMoreHangoutsBtn?.classList.add('hidden');

    insertNoHangoutsSpan();
    return;
  };

  insertAccountHangouts(accountState.data.hangoutHistory, true);
};

function loadEventListeners(): void {
  hangoutsElement?.addEventListener('click', handleHangoutsElementClicks);
};

function insertAccountHangouts(hangouts: Hangout[], isFirstCall: boolean = false): void {
  if (!accountState.data || !hangoutsContainer) {
    return;
  };

  if (accountState.data.hangoutHistory.length < accountHangoutState.fetchOffset) {
    accountHangoutState.allHangoutsFetched = true;
    loadMoreHangoutsBtn?.classList.add('hidden');

    isFirstCall || popup('All hangouts loaded.', 'success');
  };

  const fragment: DocumentFragment = new DocumentFragment();

  for (const hangout of hangouts) {
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
    return;
  };

  if (e.target.classList.contains('leave-hangout-btn')) {
    confirmLeaveHangout(e.target);
  };
};

async function loadMoreHangouts(): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (accountHangoutState.allHangoutsFetched) {
    popup('All hangouts loaded already.', 'success');
    LoadingModal.remove();

    return;
  };

  try {
    const hangouts: Hangout[] = (await loadMoreHangoutsService(accountHangoutState.fetchOffset)).data.hangouts;

    accountState.data.hangoutHistory.push(...hangouts);
    accountHangoutState.fetchOffset += ACCOUNT_HANGOUT_HISTORY_FETCH_BATCH_SIZE;

    insertAccountHangouts(hangouts);
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage } = asyncErrorData;

    if (status === 400) {
      popup('Something went wrong.', 'error');
      return;
    }

    popup(errMessage, 'error');;

    if (status === 401) {
      handleAuthSessionExpired();
    };
  };
};

async function leaveHangout(hangout: Hangout, hangoutElement: HTMLDivElement): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  try {
    await accountLeaveHangoutService(hangout.hangout_id);

    accountState.data.hangoutHistory = accountState.data.hangoutHistory.filter((existingHangout: Hangout) => existingHangout.hangout_id !== hangout.hangout_id);

    hangoutElement.remove();
    if (accountState.data.hangoutHistory.length === 0) {
      insertNoHangoutsSpan();
    };

    popup('Left hangout.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

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
    };
  };
};

function confirmLeaveHangout(clickedBtn: HTMLButtonElement): void {
  const hangoutElement: HTMLElement | null = clickedBtn.parentElement;

  if (!(hangoutElement instanceof HTMLDivElement)) {
    return;
  };

  const hangoutId: string | null = hangoutElement.getAttribute('data-hangoutId');

  if (!hangoutId) {
    return;
  };

  const hangout: Hangout | undefined = accountState.data?.hangoutHistory.find((hangout: Hangout) => hangout.hangout_id === hangoutId);

  if (!hangout) {
    hangoutElement.remove();
    popup('Left hangout.', 'success');

    return;
  };

  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: null,
    description: 'Are you sure you want to leave this hangout?',
    confirmBtnTitle: 'Confirm',
    cancelBtnTitle: 'Cancel',
    extraBtnTitle: null,
    isDangerousAction: true,
  });

  confirmModal.addEventListener('click', async (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      ConfirmModal.remove();
      await leaveHangout(hangout, hangoutElement);

      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      ConfirmModal.remove();
    };
  });
};

function checkForHangoutsHref(): void {
  const url: URL = new URL(window.location.href);

  if (url.searchParams.has('hangouts')) {
    setTimeout(() => {
      hangoutsElement?.scrollIntoView();
      document.documentElement.scrollTop -= 80;
    }, 0);
  };
};

function insertNoHangoutsSpan(): void {
  if (!hangoutsContainer) {
    return;
  };

  hangoutsContainer.appendChild(createSpanElement('no-hangouts', 'No hangouts found'));
};