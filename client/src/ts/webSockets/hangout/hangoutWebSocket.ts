import { globalHangoutState } from "../../modules/hangout/globalHangoutState";
import { hangoutWebSocketRouter } from "./hangoutWebSocketRouter";

export function initHangoutWebSocket(hangoutMemberId: number, hangoutId: string): void {
  const webSocketServerURL: string = window.location.hostname === 'localhost'
    ? 'ws://localhost:5000'
    : 'wss://www.hangoutio.com';

  const hangoutWebSocket: WebSocket = new WebSocket(`${webSocketServerURL}?hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);

  hangoutWebSocket.addEventListener('open', () => {
    globalHangoutState.hangoutWebSocket = hangoutWebSocket;
    globalHangoutState.webSocketConnected = true;

    window.addEventListener('beforeunload', () => {
      globalHangoutState.hangoutWebSocket?.close();
    });

    console.log('Websocket connection established.');
  });

  hangoutWebSocket.addEventListener('message', (e: MessageEvent) => {
    if (!e.data) {
      return;
    };

    const messageContent: unknown | null = parseJsonString(e.data);
    if (messageContent === null) {
      return;
    };

    hangoutWebSocketRouter(messageContent, hangoutWebSocket);
  });

  hangoutWebSocket.addEventListener('close', (event) => {
    console.log(`Websocket connection closed with code: ${event.code}`);
    // TODO: update global hangout state, and implement reconnection logic
  });

  hangoutWebSocket.addEventListener('error', (err) => {
    console.log(err);
    // TODO: update global hangout state, and implement reconnection logic if necessary
  });
};

function parseJsonString(message: string): unknown | null {
  try {
    return JSON.parse(message);

  } catch (err: unknown) {
    return null;
  };
};