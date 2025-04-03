import WebSocket, { WebSocketServer, RawData } from "ws";
import { hangoutWebSocketRouter } from "./hangoutWebSocketRouter";

export const wsMap: Map<string, Set<WebSocket>> = new Map();
export const wss: WebSocketServer = new WebSocket.Server({
  noServer: true,
  maxPayload: 1700,
  clientTracking: false,
  perMessageDeflate: false,
});

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (data: RawData) => {
    if (!Buffer.isBuffer(data)) {
      ws.send(JSON.stringify({ success: false, message: 'Invalid buffer received.', reason: 'notBuffer' }));
      return;
    };

    const decodedData: string = data.toString();
    const messageContent: unknown | null = parseJsonString(decodedData);

    if (messageContent === null) {
      ws.send(JSON.stringify({ success: false, message: 'Invalid buffer received', reason: 'invalidJson' }));
      return;
    };

    hangoutWebSocketRouter(messageContent, ws);
  });

  ws.on('error', (err) => {
    console.log(err);

    if (ws.readyState !== 2 && ws.readyState !== 3) {
      ws.close();
    };
  });

  ws.on('close', () => {
    for (const wsSet of wsMap.values()) {
      const foundAndDeleted: boolean = wsSet.delete(ws);

      if (foundAndDeleted) {
        return;
      };
    };
  });
});

console.log('Hangout websocket server started.');

function parseJsonString(message: string): unknown | null {
  try {
    return JSON.parse(message);

  } catch (err: unknown) {
    return null;
  };
};

// --- --- ---

interface WebSocketData {
  type: string,
  reason: string,
  data: unknown,
};

export function sendHangoutWebSocketMessage(hangoutIds: string[], webSocketData: WebSocketData): void {
  for (const hangoutId of hangoutIds) {
    const wsSet: Set<WebSocket> | undefined = wsMap.get(hangoutId);

    if (!wsSet) {
      continue;
    };

    for (const ws of wsSet.values()) {
      ws.send(JSON.stringify(webSocketData), (err: Error | undefined) => err && console.log(err));
    };
  };
};