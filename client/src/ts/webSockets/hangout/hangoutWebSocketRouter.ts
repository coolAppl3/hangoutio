import { hangoutChatState, insertSingleChatMessage } from "../../modules/hangout/chat/hangoutChat";
import { hangoutDashboardState, renderDashboardLatestMessages, renderDashboardSection } from "../../modules/hangout/dashboard/hangoutDashboard";
import { initNextStageTimer } from "../../modules/hangout/dashboard/hangoutDashboardUtils";
import { globalHangoutState } from "../../modules/hangout/globalHangoutState";
import { ChatMessage, HangoutEvent } from "../../modules/hangout/hangoutTypes";

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
  };

  if (WebSocketData.type === 'availabilitySlot') {
    handleAvailabilitySlotsUpdate(WebSocketData);
  };

  if (WebSocketData.type === 'suggestion') {
    handleSuggestionsUpdate(WebSocketData);
  };

  if (WebSocketData.type === 'vote') {
    handleVotesUpdate(WebSocketData);
  };

  if (WebSocketData.type === 'like') {
    handleLikesUpdate(WebSocketData);
  };

  if (WebSocketData.type === 'misc') {
    handleHangoutMiscUpdate(WebSocketData);
  };
};

function handleChatUpdate(webSocketData: WebSocketData): void {
  if (webSocketData.reason !== 'newMessage') {
    return;
  };

  if (!('chatMessage' in webSocketData.data)) {
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

  let newStageControlTimestamp: number = Date.now();

  if (typeof data === 'object' && data !== null && 'stageControlTimestamp' in data && typeof data.stageControlTimestamp === 'number') {
    newStageControlTimestamp = data.stageControlTimestamp;
  };

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
  if (webSocketData.reason === 'memberJoined') {
    // TODO: insert and share new member
    return;
  };

  if (webSocketData.reason === 'memberLeft') {
    // TODO: share member leaving
    return;
  };

  // TODO: Add other hangout events
};