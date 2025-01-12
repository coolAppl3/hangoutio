import { hourMilliseconds } from "../../util/constants";
import { hangoutClients } from "./hangoutWebSocketServer";

export function cleanHangoutClients(): void {
  const clientsToRemove: number[] = [];

  for (const [hangoutMemberId, webSocketClientData] of hangoutClients) {
    if (webSocketClientData.createdOn + (hourMilliseconds * 6) < Date.now()) {
      webSocketClientData.ws.close();
      clientsToRemove.push(hangoutMemberId);
    };
  };

  for (const hangoutMemberId of clientsToRemove) {
    hangoutClients.delete(hangoutMemberId);
  };
};