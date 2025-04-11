import { InfoModal } from "../../modules/global/InfoModal";
import { globalHangoutState } from "../../modules/hangout/globalHangoutState";
import { hangoutWebSocketRouter } from "./hangoutWebSocketRouter";

export function initHangoutWebSocket(hangoutMemberId: number, hangoutId: string, reconnectionAttempts: number = 0): void {
  if (reconnectionAttempts >= 2) {
    globalHangoutState.hangoutWebSocket = null;
    globalHangoutState.webSocketConnected = false;

    InfoModal.display({
      title: 'Server connection issues.',
      description: `Live server connection has been lost, and we couldn't reconnect you.\nThis may result in some hangout updates not being visible without a page reload.`,
      btnTitle: 'Okay',
    }, { simple: true });
    return;
  };

  const webSocketServerURL: string = window.location.hostname === 'localhost'
    ? 'ws://localhost:5000'
    : `wss://${window.location.hostname}`;

  const hangoutWebSocket: WebSocket = new WebSocket(`${webSocketServerURL}?hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);

  hangoutWebSocket.addEventListener('open', () => {
    globalHangoutState.hangoutWebSocket = hangoutWebSocket;
    globalHangoutState.webSocketConnected = true;
  });

  hangoutWebSocket.addEventListener('message', (e: MessageEvent) => {
    if (!e.data) {
      return;
    };

    const WebSocketData: unknown | null = parseJsonString(e.data);
    if (WebSocketData === null) {
      return;
    };

    hangoutWebSocketRouter(WebSocketData);
  });

  hangoutWebSocket.addEventListener('close', (event) => {
    if (event.code === 1000) {
      return;
    };

    console.log(`Websocket connection closed with code: ${event.code}`);
    setTimeout(() => initHangoutWebSocket(hangoutMemberId, hangoutId, ++reconnectionAttempts), 200);
  });

  hangoutWebSocket.addEventListener('error', (err) => {
    console.log(err);

    if (hangoutWebSocket.readyState === 1) {
      hangoutWebSocket.close(1011);
    };
  });
};

function parseJsonString(message: string): unknown | null {
  try {
    return JSON.parse(message);

  } catch (err: unknown) {
    return null;
  };
};