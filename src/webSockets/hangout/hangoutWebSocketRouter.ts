import WebSocket from "ws"

interface ValidWebSocketMessage {
  type: string,
  reason: string,
  data: { [key: string]: unknown },
};

function isValidClientSentMessage(wsMessage: unknown): wsMessage is ValidWebSocketMessage {
  if (typeof wsMessage !== 'object' || wsMessage === null) {
    return false;
  };

  if (!('type' in wsMessage) || typeof wsMessage.type !== 'string') {
    return false;
  };

  if (!('reason' in wsMessage) || typeof wsMessage.reason !== 'string') {
    return false;
  };

  if (!('data' in wsMessage) || typeof wsMessage.data !== 'object' || wsMessage.data === null) {
    return false;
  };

  return true;
};

export function hangoutWebSocketRouter(wsMessage: unknown, ws: WebSocket): void {
  if (!isValidClientSentMessage(wsMessage)) {
    return;
  };

  // not in use for now
};