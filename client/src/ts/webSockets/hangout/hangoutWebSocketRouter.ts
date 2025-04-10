import { InfoModal } from "../../modules/global/InfoModal";
import { hangoutChatState, insertSingleChatMessage } from "../../modules/hangout/chat/hangoutChat";
import { hangoutDashboardState, renderDashboardLatestEvents, renderDashboardLatestMessages, renderDashboardMembersContainer, renderDashboardSection } from "../../modules/hangout/dashboard/hangoutDashboard";
import { initNextStageTimer } from "../../modules/hangout/dashboard/hangoutDashboardUtils";
import { hangoutEventsState, searchHangoutEvents } from "../../modules/hangout/events/hangoutEvents";
import { globalHangoutState } from "../../modules/hangout/globalHangoutState";
import { ChatMessage, HangoutEvent, HangoutMember } from "../../modules/hangout/hangoutTypes";
import { hangoutMembersState, removeHangoutMemberData, renderMembersSection, searchHangoutMembers } from "../../modules/hangout/members/hangoutMembers";

interface WebSocketData {
  type: string,
  reason: string,
  data: { [key: string]: unknown },
};

function isValidWebSocketData(webSocketData: unknown): webSocketData is WebSocketData {
  if (typeof webSocketData !== 'object' || webSocketData === null) {
    return false;
  };

  if (!('type' in webSocketData) || typeof webSocketData.type !== 'string') {
    return false;
  };

  if (!('reason' in webSocketData) || typeof webSocketData.reason !== 'string') {
    return false;
  };

  if (!('data' in webSocketData) || typeof webSocketData.data !== 'object' || typeof webSocketData.data === null) {
    return false;
  };

  return true;
};

export function hangoutWebSocketRouter(WebSocketData: unknown): void {
  if (!isValidWebSocketData(WebSocketData)) {
    return;
  };

  if (WebSocketData.type === 'chat') {
    handleChatUpdate(WebSocketData);
    return;
  };

  if (WebSocketData.type === 'hangoutStage') {
    handleHangoutStageUpdate(WebSocketData);
    return;
  };

  if (WebSocketData.type === 'hangoutMember') {
    handleHangoutMembersUpdate(WebSocketData);
    return;
  };

  if (WebSocketData.type === 'availabilitySlot') {
    handleAvailabilitySlotsUpdate(WebSocketData);
    return;
  };

  if (WebSocketData.type === 'suggestion') {
    handleSuggestionsUpdate(WebSocketData);
    return;
  };

  if (WebSocketData.type === 'vote') {
    handleVotesUpdate(WebSocketData);
    return;
  };

  if (WebSocketData.type === 'like') {
    handleLikesUpdate(WebSocketData);
    return;
  };

  if (WebSocketData.type === 'misc') {
    handleHangoutMiscUpdate(WebSocketData);
  };
};

function handleChatUpdate(webSocketData: WebSocketData): void {
  if (webSocketData.reason !== 'newMessage') {
    return;
  };

  if (!webSocketData.data.chatMessage) {
    return;
  };

  const newMessage = webSocketData.data.chatMessage as ChatMessage;

  if (newMessage.hangout_member_id === globalHangoutState.data?.hangoutMemberId) {
    return;
  };

  hangoutChatState.messages.push(newMessage);
  insertSingleChatMessage(newMessage, false);

  renderDashboardLatestMessages();
};

function handleHangoutStageUpdate(webSocketData: WebSocketData): void {
  if (!globalHangoutState.data) {
    return;
  };

  const { hangoutDetails } = globalHangoutState.data;
  const { reason, data } = webSocketData;

  if (typeof data.stageControlTimestamp !== 'number' || !Number.isInteger(data.stageControlTimestamp)) {
    return;
  };

  const newStageControlTimestamp = data.stageControlTimestamp;

  if (reason === 'hangoutAutoProgressed') {
    hangoutDetails.current_stage++;

    if (hangoutDetails.current_stage === 4) {
      const newHangoutEvent: HangoutEvent = {
        event_description: 'Hangout has been concluded.',
        event_timestamp: newStageControlTimestamp,
      };

      hangoutDashboardState.latestHangoutEvents.push(newHangoutEvent);
    };
  };

  if (reason === 'noSuggestionConclusion') {
    hangoutDetails.current_stage = 4;

    const newHangoutEvent: HangoutEvent = {
      event_description: 'Hangout reached the voting stage without any suggestions and was therefore automatically concluded.',
      event_timestamp: newStageControlTimestamp,
    };

    hangoutDashboardState.latestHangoutEvents.unshift(newHangoutEvent);
  };

  hangoutDetails.stage_control_timestamp = newStageControlTimestamp;

  renderDashboardSection();
  initNextStageTimer();
};

function handleHangoutMembersUpdate(webSocketData: WebSocketData): void {
  if (!globalHangoutState.data) {
    return;
  };

  const { reason, data } = webSocketData;

  if (reason === 'memberJoined') {
    if (!data.newMember) {
      return;
    };

    const newMember = data.newMember as HangoutMember;

    globalHangoutState.data.hangoutMembers.push(newMember);
    globalHangoutState.data.hangoutMembersMap.set(newMember.hangout_member_id, newMember.display_name);

    renderDashboardMembersContainer();
    hangoutMembersState.isLoaded && searchHangoutMembers(); // will rerender

    insertNewHangoutEvent(webSocketData);
    return;
  };

  if (reason === 'memberKicked') {
    if (typeof data.kickedMemberId !== 'number' || !Number.isInteger(data.kickedMemberId)) {
      return;
    };

    if (globalHangoutState.data.isLeader) { // can't be kicked, and already received necessary updates, as the action originated from them
      insertNewHangoutEvent(webSocketData);
      return;
    };

    if (data.kickedMemberId === globalHangoutState.data.hangoutMemberId) {
      globalHangoutState.hangoutWebSocket?.close(1000);

      const infoModal: HTMLDivElement = InfoModal.display({
        title: null,
        description: `You've been kicked from this hangout.`,
        btnTitle: 'Okay',
      });

      infoModal.addEventListener('click', (e: MouseEvent) => {
        if (!(e.target instanceof HTMLButtonElement)) {
          return;
        };

        if (e.target.id === 'info-modal-btn') {
          window.location.href = 'home';
        };
      });

      return;
    };

    removeHangoutMemberData(data.kickedMemberId);

    renderDashboardMembersContainer();
    hangoutMembersState.isLoaded && renderMembersSection();

    insertNewHangoutEvent(webSocketData);
    return;
  };

  if (reason === 'memberLeft') {
    if (typeof data.leftMemberId !== 'number' || !Number.isInteger(data.leftMemberId)) {
      return;
    };

    if (data.leftMemberId === globalHangoutState.data.hangoutMemberId) {
      return;
    };

    removeHangoutMemberData(data.leftMemberId);

    renderDashboardMembersContainer();
    hangoutMembersState.isLoaded && renderMembersSection();

    insertNewHangoutEvent(webSocketData);
    return;
  };

  if (reason === 'leadershipRelinquished') {
    if (typeof data.previousLeaderId !== 'number' || !Number.isInteger(data.previousLeaderId)) {
      return;
    };

    if (data.previousLeaderId === globalHangoutState.data.hangoutMemberId) {
      insertNewHangoutEvent(webSocketData);
      return;
    };

    const hangoutMember: HangoutMember | undefined = globalHangoutState.data.hangoutMembers.find((member: HangoutMember) => member.hangout_member_id === data.previousLeaderId);

    hangoutMember && (hangoutMember.is_leader = false);
    hangoutMembersState.hasLeader = false;

    renderDashboardMembersContainer();
    hangoutMembersState.isLoaded && renderMembersSection();

    insertNewHangoutEvent(webSocketData);
    return;
  };

  if (reason === 'leadershipTransferred') {
    if (typeof data.previousLeaderId !== 'number' || !Number.isInteger(data.previousLeaderId)) {
      return;
    };

    if (typeof data.newLeaderId !== 'number' || !Number.isInteger(data.newLeaderId)) {
      return;
    };

    if (data.previousLeaderId === globalHangoutState.data.hangoutMemberId) {
      insertNewHangoutEvent(webSocketData);
      return;
    };

    const previousLeader: HangoutMember | undefined = globalHangoutState.data.hangoutMembers.find((member: HangoutMember) => member.hangout_member_id === data.previousLeaderId);
    const newLeader: HangoutMember | undefined = globalHangoutState.data.hangoutMembers.find((member: HangoutMember) => member.hangout_member_id === data.newLeader);

    previousLeader && (previousLeader.is_leader = false);
    newLeader && (newLeader.is_leader = true);

    if (data.newLeaderId === globalHangoutState.data.hangoutMemberId) {
      globalHangoutState.data.isLeader = true;

      InfoModal.display({
        title: `You're now the hangout leader.`,
        description: `${previousLeader?.display_name} has transferred the hangout leadership to you.`,
        btnTitle: 'Okay',
      }, { simple: true });
    };

    renderDashboardMembersContainer();
    hangoutMembersState.isLoaded && renderMembersSection();

    insertNewHangoutEvent(webSocketData);
    return;
  };

  if (reason === 'leadershipClaimed') {
    if (typeof data.newLeaderMemberId !== 'number' || !Number.isInteger(data.newLeaderMemberId)) {
      return;
    };

    const newLeaderMemberId: number = data.newLeaderMemberId;

    if (newLeaderMemberId === globalHangoutState.data.hangoutMemberId) {
      insertNewHangoutEvent(webSocketData);
      return;
    };

    const newLeaderMember: HangoutMember | undefined = globalHangoutState.data.hangoutMembers.find((member: HangoutMember) => member.hangout_member_id === newLeaderMemberId);

    newLeaderMember && (newLeaderMember.is_leader = true);
    hangoutMembersState.hasLeader = true;

    renderMembersSection();
  };
};

function handleAvailabilitySlotsUpdate(webSocketData: WebSocketData): void {
  // TODO: implement
};

function handleSuggestionsUpdate(webSocketData: WebSocketData): void {
  // TODO: implement
};

function handleVotesUpdate(webSocketData: WebSocketData): void {
  // TODO: implement
};

function handleLikesUpdate(webSocketData: WebSocketData): void {
  // TODO: implement
};

function handleHangoutMiscUpdate(webSocketData: WebSocketData): void {
  // TODO: implement
};

// --- --- ---

function insertNewHangoutEvent(webSocketData: WebSocketData): void {
  if (!globalHangoutState.data) {
    return;
  };

  const data: { [key: string]: unknown } = webSocketData.data;

  if (typeof data.eventDescription !== 'string') {
    return;
  };

  if (typeof data.eventTimestamp !== 'number' || !Number.isInteger(data.eventTimestamp)) {
    return;
  };

  const newEvent: HangoutEvent = {
    event_description: data.eventDescription,
    event_timestamp: data.eventTimestamp,
  };

  hangoutDashboardState.latestHangoutEvents.unshift(newEvent);
  hangoutDashboardState.latestHangoutEvents.length > 2 && hangoutDashboardState.latestHangoutEvents.pop();
  renderDashboardLatestEvents();

  if (!hangoutEventsState.isLoaded) {
    return;
  };

  hangoutEventsState.hangoutEvents.unshift(newEvent);
  searchHangoutEvents(); // will rerender
};