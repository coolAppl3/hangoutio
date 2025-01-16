import { renderHangoutStageDescriptions, renderMainDashboardContent } from "../../modules/hangout/dashboard/hangoutDashboard";
import { initiateNextStageTimer } from "../../modules/hangout/dashboard/hangoutDashboardUtils";
import { globalHangoutState } from "../../modules/hangout/globalHangoutState";

interface WebSocketData {
  type: string,
  reason: string,
  data: unknown,
};

export function hangoutWebSocketRouter(WebSocketData: unknown, ws: WebSocket): void {
  if (!isValidWebSocketData(WebSocketData)) {
    return;
  };

  if (WebSocketData.type === 'hangoutStageUpdate') {
    handleHangoutStageUpdate(WebSocketData);
  };

  if (WebSocketData.type === 'chatUpdate') {
    handleHangoutChatUpdates(WebSocketData, ws);
    return;
  };

  if (WebSocketData.type === 'newData') {
    handleNewHangoutData(WebSocketData, ws);
    return;
  };

  if (WebSocketData.type === 'hangoutUtil') {
    handleHangoutUtilUpdates(WebSocketData, ws);
  };
};

function handleHangoutChatUpdates(messageContent: WebSocketData, ws: WebSocket): void {
  if (messageContent.reason === 'newMessage') {
    // TODO: share new message.
    return;
  };

  if (messageContent.reason === 'userTyping') {
    // TODO: share user typing.
  };
};

function handleNewHangoutData(messageContent: WebSocketData, ws: WebSocket): void {
  if (messageContent.reason === 'newAvailabilitySlot') {
    // TODO: insert and share new slot
    return;
  };

  if (messageContent.reason === 'newSuggestions') {
    // TODO: insert and share new suggestion
    return;
  };

  if (messageContent.reason === 'newVote') {
    // TODO: insert and share new vote
  };
};

function handleHangoutUtilUpdates(messageContent: WebSocketData, ws: WebSocket): void {
  if (messageContent.reason === 'memberJoined') {
    // TODO: insert and share new member
    return;
  };

  if (messageContent.reason === 'memberLeft') {
    // TODO: share member leaving
    return;
  };

  // TODO: Add other hangout events
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
    hangoutDetails.stage_control_timestamp = newStageControlTimestamp;

    renderMainDashboardContent();
    renderHangoutStageDescriptions();

    initiateNextStageTimer();
    return;
  };

  if (reason === 'noSuggestionConclusion') {
    hangoutDetails.current_stage = 4;
    hangoutDetails.stage_control_timestamp = newStageControlTimestamp;

    renderMainDashboardContent();
    renderHangoutStageDescriptions();

    initiateNextStageTimer(true);
    return;
  };
};

function isValidWebSocketData(messageContent: unknown): messageContent is WebSocketData {
  if (typeof messageContent !== 'object' || messageContent === null) {
    return false;
  };

  if (!('type' in messageContent) || typeof messageContent.type !== 'string') {
    return false;
  };

  if (!('reason' in messageContent) || typeof messageContent.reason !== 'string') {
    return false;
  };

  if (!('data' in messageContent) || typeof messageContent.data !== 'object' || typeof messageContent.data === null) {
    return false;
  };

  return true;
};
