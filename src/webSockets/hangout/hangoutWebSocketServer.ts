import WebSocket, { WebSocketServer, RawData } from "ws";
import { hangoutWebSocketServerRouter } from "./hangoutWebsocketServerRouter";

export const wss: WebSocketServer = new WebSocket.Server({
  noServer: true,
  maxPayload: 1700,
  clientTracking: false,
  perMessageDeflate: false,
});

console.log('Hangout websocket server started.');

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected.');

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
      // TODO: remove from the hangoutClients map
    };
  });

  ws.on('close', () => {
    console.log('Client disconnected.');
  });
});

export const hangoutClients: Map<string, Set<{ ws: WebSocket, hangoutMemberId: number }>> = new Map();

export function insertIntoHangoutClients(hangoutId: string, hangoutMemberId: number, ws: WebSocket): void {
  if (!hangoutClients.has(hangoutId)) {
    hangoutClients.set(hangoutId, new Set<{ ws: WebSocket, hangoutMemberId: number }>());
    hangoutClients.get(hangoutId)?.add({ ws, hangoutMemberId });

    return;
  };

  hangoutClients.get(hangoutId)?.add({ ws, hangoutMemberId });
};

function parseJsonString(message: string): unknown | null {
  try {
    return JSON.parse(message);

  } catch (err: unknown) {
    return null;
  };
};