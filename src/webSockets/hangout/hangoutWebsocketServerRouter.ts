import WebSocket from "ws"

interface ValidClientSentMessage {
  type: string,
  reason: string,
  data: { [key: string]: unknown },
};

function isValidClientSentMessage(messageContent: unknown): messageContent is ValidClientSentMessage {
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

export function hangoutWebSocketServerRouter(messageContent: unknown, ws: WebSocket): void {
  if (!isValidClientSentMessage(messageContent)) {
    return;
  };

  if (messageContent.type === 'chatUpdate') {
    handleHangoutChatUpdates(messageContent, ws);
  };
};

function handleHangoutChatUpdates(messageContent: ValidClientSentMessage, ws: WebSocket): void {
  if (messageContent.reason === 'userTyping') {
    // TODO: send user typing to clients.
    return;
  };
};