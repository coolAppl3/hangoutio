import WebSocket, { WebSocketServer, RawData } from "ws";
import { hangoutWebSocketServerRouter } from "./hangoutWebSocketRouter";

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

interface WebSocketClientData {
  ws: WebSocket,
  createdOn: number,
};

export const hangoutClients: Map<number, WebSocketClientData> = new Map();

function parseJsonString(message: string): unknown | null {
  try {
    return JSON.parse(message);

  } catch (err: unknown) {
    return null;
  };
};