import { handleAuthSessionExpired } from "../global/authUtils";
import { HANGOUT_INVITES_FETCH_BATCH_SIZE } from "../global/clientConstants";
import { getFullDateSTring } from "../global/dateTimeUtils";
import { createBtnElement, createDivElement, createParagraphElement, createSpanElement } from "../global/domUtils";
import { AsyncErrorData, getAsyncErrorData } from "../global/errorUtils";
import LoadingModal from "../global/LoadingModal";
import popup from "../global/popup";
import { loadMoreHangoutInvitesService } from "../services/accountServices";
import { HangoutInvite } from "./accountTypes";
import { accountState } from "./initAccount";

interface HangoutInvitesState {
  currentOffset: number,
  offsetIncrement: number,

  allInvitesFetched: boolean,
};

const hangoutInvitesState: HangoutInvitesState = {
  currentOffset: HANGOUT_INVITES_FETCH_BATCH_SIZE,
  offsetIncrement: HANGOUT_INVITES_FETCH_BATCH_SIZE,

  allInvitesFetched: false,
};

const hangoutInvitesElement: HTMLDivElement | null = document.querySelector('#hangout-invites');
const hangoutInvitesContainer: HTMLDivElement | null = document.querySelector('#hangout-invites-container');
const loadMoreHangoutInvitesBtn: HTMLButtonElement | null = document.querySelector('#load-more-hangout-invites-btn');

export function initHangoutInvites(): void {
  if (!accountState.data) {
    return;
  };

  loadEventListeners();

  if (accountState.data.hangoutInvites.length === 0) {
    loadMoreHangoutInvitesBtn?.classList.add('hidden');
    return;
  };

  insertHangoutInvites(accountState.data.hangoutInvites);
  hangoutInvitesContainer?.firstElementChild?.remove();
};

function loadEventListeners(): void {
  hangoutInvitesElement?.addEventListener('click', handleHangoutInvitesElementClicks);
};

function insertHangoutInvites(hangoutInvites: HangoutInvite[]): void {
  const fragment: DocumentFragment = new DocumentFragment();

  for (const invite of hangoutInvites) {
    fragment.appendChild(createHangoutInviteElement(invite));
  };

  hangoutInvitesContainer?.appendChild(fragment);

  if (hangoutInvites.length === hangoutInvitesState.offsetIncrement) {
    return;
  };

  hangoutInvitesState.allInvitesFetched = true;
  loadMoreHangoutInvitesBtn?.classList.add('hidden');
};

async function handleHangoutInvitesElementClicks(e: MouseEvent): Promise<void> {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.id === 'load-more-hangout-invites-btn') {
    await loadMoreHangoutInvites();
    return;
  };

  // TODO: continue implementation
};

async function loadMoreHangoutInvites(): Promise<void> {
  LoadingModal.display();

  if (!accountState.data) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (hangoutInvitesState.allInvitesFetched) {
    loadMoreHangoutInvitesBtn?.classList.add('hidden');

    popup('All invites have already been loaded.', 'success');
    LoadingModal.remove();

    return;
  };

  try {
    const hangoutInvites: HangoutInvite[] = (await loadMoreHangoutInvitesService(hangoutInvitesState.currentOffset)).data;

    accountState.data.hangoutInvites.push(...hangoutInvites);
    hangoutInvitesState.currentOffset += hangoutInvitesState.offsetIncrement;

    insertHangoutInvites(hangoutInvites);
    LoadingModal.remove();

    if (hangoutInvites.length < hangoutInvitesState.offsetIncrement) {
      popup('All invitations loaded.', 'success');
    };

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      popup('Something went wrong.', 'error');
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

// --- --- ---

function createHangoutInviteElement(hangoutInvite: HangoutInvite): HTMLDivElement {
  const hangoutInviteElement: HTMLDivElement = createDivElement('hangout-invite');

  hangoutInviteElement.setAttribute('data-hangoutId', hangoutInvite.hangout_id);
  hangoutInviteElement.setAttribute('data-inviteId', `${hangoutInvite.invite_id}`);

  hangoutInviteElement.appendChild(createInviteDetailsElement(hangoutInvite));
  hangoutInviteElement.appendChild(createBtnContainer());

  return hangoutInviteElement;
};

function createInviteDetailsElement(hangoutInvite: HangoutInvite): HTMLDivElement {
  const inviteDetailsElement: HTMLDivElement = createDivElement('hangout-invite-details');

  const firstParagraphElement: HTMLParagraphElement = createParagraphElement(null, `${hangoutInvite.display_name} (@${hangoutInvite.username}) invited you to join: `);
  firstParagraphElement.appendChild(createSpanElement(null, hangoutInvite.hangout_title));

  inviteDetailsElement.appendChild(firstParagraphElement);
  inviteDetailsElement.appendChild(createParagraphElement(null, `Sent on: ${getFullDateSTring(hangoutInvite.invite_timestamp)}`));

  return inviteDetailsElement;
};

function createBtnContainer(): HTMLDivElement {
  const btnContainer: HTMLDivElement = createDivElement('btn-container');

  btnContainer.appendChild(createBtnElement('reject-invite-btn', 'Reject'));
  btnContainer.appendChild(createBtnElement('accept-invite-btn', 'Accept'));

  return btnContainer;
};