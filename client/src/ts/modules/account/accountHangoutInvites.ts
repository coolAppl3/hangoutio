import { HANGOUT_INVITES_FETCH_BATCH_SIZE } from "../global/clientConstants";
import { getFullDateSTring } from "../global/dateTimeUtils";
import { createBtnElement, createDivElement, createParagraphElement, createSpanElement } from "../global/domUtils";
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

const hangoutInvitesContainer: HTMLDivElement | null = document.querySelector('#hangout-invites-container');
const loadMoreHangoutInvitesBtn: HTMLButtonElement | null = document.querySelector('#load-more-hangout-invites-btn');

export function initHangoutInvites(): void {
  if (!accountState.data) {
    return;
  };

  loadEventListeners();

  insertHangoutInvites(accountState.data.hangoutInvites);
  hangoutInvitesContainer?.firstElementChild?.remove();
};

function loadEventListeners(): void {

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