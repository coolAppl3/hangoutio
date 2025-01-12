import WebSocket, { WebSocketServer, RawData } from "ws";
import { hangoutWebSocketServerRouter } from "./hangoutWebSocketRouter";
import { hourMilliseconds } from "../../util/constants";

export const wss: WebSocketServer = new WebSocket.Server({
  noServer: true,
  maxPayload: 1700,
  clientTracking: false,
  perMessageDeflate: false,
});

console.log('Hangout websocket server started.');

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

    hangoutWebSocketServerRouter(messageContent, ws);
  });

  ws.on('error', (err) => {
    console.log(err);

    if (ws.readyState !== 2 && ws.readyState !== 3) {
      ws.close();
    };
  });

  ws.on('close', () => { });
});

interface WebSocketClientData {
  ws: WebSocket,
  hangoutId: string,
  createdOn: number,
};

export const hangoutClients: Map<number, WebSocketClientData> = new Map();

export function clearExpiredHangoutWebSockets(): void {
  for (const [hangoutMemberId, webSocketClientData] of hangoutClients) {
    if (webSocketClientData.createdOn + (hourMilliseconds * 6) < Date.now()) {
      webSocketClientData.ws.close();
      hangoutClients.delete(hangoutMemberId);

      continue;
    };

    if (webSocketClientData.ws.readyState === 2 || webSocketClientData.ws.readyState === 3) {
      hangoutClients.delete(hangoutMemberId);
    };
  };
};

function parseJsonString(message: string): unknown | null {
  try {
    return JSON.parse(message);

  } catch (err: unknown) {
    return null;
  };
};