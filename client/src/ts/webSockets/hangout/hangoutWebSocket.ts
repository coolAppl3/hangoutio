import { hangoutWebSocketRouter } from "./hangoutWebSocketRouter";

export function initHangoutWebSocket(hangoutMemberId: number): void {
  const webSocketServerURL: string = window.location.hostname === 'localhost'
    ? 'ws://localhost:5000'
    : 'wss://www.hangoutio.com';
  const socket: WebSocket = new WebSocket(`${webSocketServerURL}?hangoutMemberId=${hangoutMemberId}`);

  socket.addEventListener('open', () => {
    console.log('Websocket connection established.');
    // TODO: update global hangout state to confirm a ws connection is established
  });

  socket.addEventListener('message', (e: MessageEvent) => {
    if (!e.data) {
      return;
    };

    const messageContent: unknown | null = parseJsonString(e.data);
    if (messageContent === null) {
      return;
    };

    hangoutWebSocketRouter(messageContent, socket);
  });

  socket.addEventListener('close', (event) => {
    console.log(`Websocket connection closed with code: ${event.code}`);
    // TODO: update global hangout state, and implement reconnection logic
  });

  socket.addEventListener('error', (err) => {
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