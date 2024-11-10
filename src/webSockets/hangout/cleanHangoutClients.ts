import { hangoutClients } from "./hangoutWebSocketServer";

export function cleanHangoutClients(): void {
  if (hangoutClients.size === 0) {
    return;
  };

  for (const [hangoutId, clientSet] of hangoutClients) {
    if (clientSet.size === 0) {
      hangoutClients.delete(hangoutId);
      continue;
    };

    for (const client of clientSet) {
      if (client.ws.readyState === 2 || client.ws.readyState === 3) {
        clientSet.delete(client);
      };
    };
  };
};