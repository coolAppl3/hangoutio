import { HANGOUT_CONCLUSION_STAGE } from "../../modules/global/clientConstants";
import { InfoModal } from "../../modules/global/InfoModal";
import { availabilityCalendarState, resetAvailabilityCalendar } from "../../modules/hangout/availability/availabilityCalendar";
import { hangoutAvailabilityState, removeOutOfBoundsAvailabilitySlots } from "../../modules/hangout/availability/hangoutAvailability";
import { hangoutChatState, insertSingleChatMessage } from "../../modules/hangout/chat/hangoutChat";
import { hangoutDashboardState, renderDashboardLatestEvents, renderDashboardLatestMessages, renderDashboardMembersContainer, renderDashboardSection, renderDashboardMainContent, updateDashboardHangoutPasswordInfo } from "../../modules/hangout/dashboard/hangoutDashboard";
import { renderDashboardStageDescriptions } from "../../modules/hangout/dashboard/hangoutDashboardUtils";
import { hangoutEventsState, searchHangoutEvents } from "../../modules/hangout/events/hangoutEvents";
import { globalHangoutState } from "../../modules/hangout/globalHangoutState";
import { directlyNavigateHangoutSections } from "../../modules/hangout/hangoutNav";
import { ChatMessage, HangoutEvent, HangoutMember, HangoutsDetails } from "../../modules/hangout/hangoutTypes";
import { hangoutMembersState, removeHangoutMemberData, renderMembersSection, searchHangoutMembers } from "../../modules/hangout/members/hangoutMembers";
import { hangoutSettingsState, renderHangoutSettingsSection } from "../../modules/hangout/settings/hangoutSettings";
import { hangoutSuggestionState, removeOutOfBoundsSuggestions, updateRemainingSuggestionsCount, updateRemainingVotesCount } from "../../modules/hangout/suggestions/hangoutSuggestions";
import { updateSuggestionsFormHeader } from "../../modules/hangout/suggestions/suggestionsUtils";

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

  if (WebSocketData.type === 'hangout') {
    handleHangoutUpdate(WebSocketData);
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

function handleHangoutUpdate(webSocketData: WebSocketData): void {
  if (!globalHangoutState.data) {
    return;
  };

  const { reason, data } = webSocketData;

  if (reason === 'passwordUpdated') {
    if (typeof data.isPasswordProtected !== 'boolean') {
      return;
    };

    globalHangoutState.data.isPasswordProtected = data.isPasswordProtected;
    updateDashboardHangoutPasswordInfo();

    insertNewHangoutEvent(webSocketData);
    return;
  };

  if (reason === 'titleUpdated') {
    if (typeof data.newTitle !== 'string') {
      return;
    };

    globalHangoutState.data.hangoutDetails.hangout_title = data.newTitle;
    renderDashboardMainContent();

    insertNewHangoutEvent(webSocketData);
    return;
  };

  if (reason === 'memberLimitUpdated') {
    if (typeof data.newMemberLimit !== 'number' || !Number.isInteger(data.newMemberLimit)) {
      return;
    };

    globalHangoutState.data.hangoutDetails.members_limit = data.newMemberLimit;

    renderDashboardMainContent();
    renderDashboardMembersContainer();

    insertNewHangoutEvent(webSocketData);
    return;
  };

  if (reason === 'hangoutStagesUpdated') {
    const { newAvailabilityPeriod, newSuggestionsPeriod, newVotingPeriod } = data;
    const hangoutDetails: HangoutsDetails = globalHangoutState.data.hangoutDetails;

    if (typeof newAvailabilityPeriod !== 'number' || typeof newSuggestionsPeriod !== 'number' || typeof newVotingPeriod !== 'number') {
      return;
    };

    if (!Number.isInteger(newAvailabilityPeriod) || !Number.isInteger(newSuggestionsPeriod) || !Number.isInteger(newSuggestionsPeriod)) {
      return;
    };

    hangoutDetails.availability_period = newAvailabilityPeriod;
    hangoutDetails.suggestions_period = newSuggestionsPeriod;
    hangoutDetails.voting_period = newVotingPeriod;

    const previousConclusionTimestamp = globalHangoutState.data.conclusionTimestamp;
    const newHangoutConclusionTimestamp: number = hangoutDetails.created_on_timestamp + newAvailabilityPeriod + newSuggestionsPeriod + newVotingPeriod;

    globalHangoutState.data.conclusionTimestamp = newHangoutConclusionTimestamp;

    clearInterval(hangoutDashboardState.nextStageTimerIntervalId);
    hangoutDashboardState.nextStageTimerInitiated = false;

    if (newHangoutConclusionTimestamp > previousConclusionTimestamp) {
      hangoutSuggestionState.isLoaded && removeOutOfBoundsSuggestions(newHangoutConclusionTimestamp);
      hangoutAvailabilityState.isLoaded && removeOutOfBoundsAvailabilitySlots(newHangoutConclusionTimestamp);
    };

    renderDashboardMainContent(); // will restart the next-stage timer
    availabilityCalendarState.hasBeenInitiated && resetAvailabilityCalendar();

    insertNewHangoutEvent(webSocketData);
    return;
  };

  if (reason === 'hangoutManuallyProgressed') {
    if (typeof data.updatedHangoutDetails !== 'object' || data.updatedHangoutDetails === null) {
      return;
    };

    if (!isValidUpdatedHangoutDetails(data.updatedHangoutDetails)) {
      console.log(data)
      return;
    };

    const updatedHangoutDetails = data.updatedHangoutDetails as UpdatedHangoutDetails;
    const hangoutDetails: HangoutsDetails = globalHangoutState.data.hangoutDetails;

    globalHangoutState.data.conclusionTimestamp = updatedHangoutDetails.conclusion_timestamp;
    hangoutDetails.availability_period = updatedHangoutDetails.availability_period;
    hangoutDetails.suggestions_period = updatedHangoutDetails.suggestions_period;
    hangoutDetails.voting_period = updatedHangoutDetails.voting_period;
    hangoutDetails.stage_control_timestamp = updatedHangoutDetails.stage_control_timestamp;
    hangoutDetails.current_stage = updatedHangoutDetails.current_stage;
    hangoutDetails.is_concluded = updatedHangoutDetails.is_concluded;

    clearInterval(hangoutDashboardState.nextStageTimerIntervalId);
    hangoutDashboardState.nextStageTimerInitiated = false;

    renderDashboardMainContent();
    renderDashboardStageDescriptions();

    availabilityCalendarState.hasBeenInitiated && resetAvailabilityCalendar();

    if (hangoutSuggestionState.isLoaded) {
      updateRemainingSuggestionsCount();
      updateRemainingVotesCount();
      updateSuggestionsFormHeader();
    };

    insertNewHangoutEvent(webSocketData);
    displayHangoutConcludedInfoModal();

    return;
  };

  if (reason === 'hangoutAutoProgressed' || reason === 'singleSuggestionConclusion' || reason === 'noSuggestionConclusion') {
    if (typeof data.newStageControlTimestamp !== 'number' || !Number.isInteger(data.newStageControlTimestamp)) {
      return;
    };

    const { hangoutDetails, isLeader } = globalHangoutState.data;

    hangoutDetails.stage_control_timestamp = data.newStageControlTimestamp;
    reason === 'hangoutAutoProgressed' ? hangoutDetails.current_stage++ : hangoutDetails.current_stage = HANGOUT_CONCLUSION_STAGE;

    renderDashboardMainContent();
    renderDashboardStageDescriptions();

    if (hangoutDetails.current_stage === HANGOUT_CONCLUSION_STAGE || reason !== 'hangoutAutoProgressed') {
      hangoutDetails.is_concluded = true;
      globalHangoutState.data.conclusionTimestamp = data.newStageControlTimestamp;

      displayHangoutConcludedInfoModal();
    };

    hangoutSuggestionState.isLoaded && renderDashboardSection();
    (hangoutSettingsState.isLoaded && isLeader) && renderHangoutSettingsSection();
  };
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

function displayHangoutConcludedInfoModal(): void {
  const infoModal: HTMLDivElement = InfoModal.display({
    title: null,
    description: 'Hangout has been manually concluded.',
    btnTitle: 'View outcome',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      directlyNavigateHangoutSections('conclusion');
      InfoModal.remove();
    };
  });
};

// --- --- ---

interface UpdatedHangoutDetails {
  availability_period: number,
  suggestions_period: number,
  voting_period: number,
  conclusion_timestamp: number,
  stage_control_timestamp: number,
  current_stage: number,
  is_concluded: boolean,
};

function isValidUpdatedHangoutDetails(updatedHangoutDetails: object): updatedHangoutDetails is UpdatedHangoutDetails {
  if (
    !('availability_period' in updatedHangoutDetails) ||
    !('suggestions_period' in updatedHangoutDetails) ||
    !('voting_period' in updatedHangoutDetails) ||
    !('conclusion_timestamp' in updatedHangoutDetails) ||
    !('stage_control_timestamp' in updatedHangoutDetails) ||
    !('current_stage' in updatedHangoutDetails) ||
    !('is_concluded' in updatedHangoutDetails)
  ) {
    return false;
  };


  for (const [key, value] of Object.entries(updatedHangoutDetails)) {
    if (key === 'is_concluded') {
      if (typeof value !== 'boolean') {
        return false;
      };

      continue;
    };

    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return false;
    };
  };

  return true;
};