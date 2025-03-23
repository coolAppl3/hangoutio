import { createDivElement } from "../../global/domUtils";
import popup from "../../global/popup";
import { globalHangoutState } from "../globalHangoutState";
import { createMemberElement } from "./membersUtils";

interface HangoutMembersState {
  changesToRender: boolean,
};

const hangoutMembersState: HangoutMembersState = {
  changesToRender: true,
};

const membersContainer: HTMLDivElement | null = document.querySelector('#members-container');

export function hangoutMembers(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  document.addEventListener('loadSection-members', renderMembersSection);
};

function renderMembersSection(): void {
  if (!hangoutMembersState.changesToRender) {
    return;
  };

  renderMembersContainer();
  hangoutMembersState.changesToRender = false;
};

function renderMembersContainer(): void {
  if (!globalHangoutState.data || !membersContainer) {
    popup('Failed to load hangout members.', 'error');
    return;
  };

  const { isLeader, hangoutMembers } = globalHangoutState.data;
  const innerMembersContainer: HTMLDivElement = createDivElement(null, 'members-container-inner');

  for (const member of hangoutMembers) {
    innerMembersContainer.appendChild(createMemberElement(member, isLeader));
  };

  membersContainer.firstElementChild?.remove();
  membersContainer.appendChild(innerMembersContainer);
};