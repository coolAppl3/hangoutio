interface ValidServerSentMessage {
  type: string,
  reason: string,
  data: { [key: string]: unknown },
};

function isValidServerSentMessage(messageContent: unknown): messageContent is ValidServerSentMessage {
  if (typeof messageContent !== 'object' || messageContent === null) {
    return false;
  };

  if (!('type' in messageContent) || typeof messageContent.type !== 'string') {
    return false;
  };

  if (!('reason' in messageContent) || typeof messageContent.reason !== 'string') {
    return false;
  };

  if (!('data' in messageContent) || typeof messageContent.data !== 'object') {
    return false;
  };

  if (messageContent.data === null || Object.getPrototypeOf(messageContent.data) !== Object.prototype) {
    return false;
  };

  return true;
};

export function hangoutWebSocketRouter(messageContent: unknown, ws: WebSocket): void {
  if (!isValidServerSentMessage(messageContent)) {
    return;
  };

  if (messageContent.type === 'chatUpdate') {
    handleHangoutChatUpdates(messageContent, ws);
    return;
  };

  if (messageContent.type === 'newData') {
    handleNewHangoutData(messageContent, ws);
    return;
  };

  if (messageContent.type === 'hangoutUtil') {
    handleHangoutUtilUpdates(messageContent, ws);
    return;
  };
};

function handleHangoutChatUpdates(messageContent: ValidServerSentMessage, ws: WebSocket): void {
  if (messageContent.reason === 'newMessage') {
    // TODO: share new message.
    return;
  };

  if (messageContent.reason === 'userTyping') {
    // TODO: share user typing.
    return;
  };
};

function handleNewHangoutData(messageContent: ValidServerSentMessage, ws: WebSocket): void {
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
    return;
  };
};

function handleHangoutUtilUpdates(messageContent: ValidServerSentMessage, ws: WebSocket): void {
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