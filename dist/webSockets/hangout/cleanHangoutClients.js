"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanHangoutClients = void 0;
const hangoutWebSocketServer_1 = require("./hangoutWebSocketServer");
function cleanHangoutClients() {
    if (hangoutWebSocketServer_1.hangoutClients.size === 0) {
        return;
    }
    ;
    for (const [hangoutId, clientSet] of hangoutWebSocketServer_1.hangoutClients) {
        if (clientSet.size === 0) {
            hangoutWebSocketServer_1.hangoutClients.delete(hangoutId);
            continue;
        }
        ;
        for (const client of clientSet) {
            if (client.ws.readyState === 2 || client.ws.readyState === 3) {
                clientSet.delete(client);
            }
            ;
        }
        ;
    }
    ;
}
exports.cleanHangoutClients = cleanHangoutClients;
;
