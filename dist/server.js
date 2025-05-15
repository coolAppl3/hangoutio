"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const hangoutWebSocketServer_1 = require("./webSockets/hangout/hangoutWebSocketServer");
const app_1 = require("./app");
const hangoutWebSocketAuth_1 = require("./webSockets/hangout/hangoutWebSocketAuth");
const initDb_1 = require("./db/initDb");
const cronInit_1 = require("./cron-jobs/cronInit");
const port = process.env.PORT ? +process.env.PORT : 5000;
const server = http_1.default.createServer(app_1.app);
server.on('upgrade', async (req, socket, head) => {
    socket.on('error', (err) => {
        if (('errno' in err) && err.errno === -4077) {
            socket.end();
            return;
        }
        ;
        console.log(err, err.stack);
        socket.write(`HTTP/1.1 ${http_1.default.STATUS_CODES[500]}\r\n\r\n`);
        socket.write('Internal server error\r\n');
        socket.end();
    });
    const memoryUsageMegabytes = process.memoryUsage().rss / Math.pow(1024, 2);
    const memoryThreshold = +(process.env.WS_ALLOW_MEMORY_THRESHOLD_MB || 500);
    if (memoryUsageMegabytes >= memoryThreshold) {
        socket.write(`HTTP/1.1 ${http_1.default.STATUS_CODES[509]}\r\n\r\n`);
        socket.write('Temporarily unavailable\r\n');
        socket.end();
        return;
    }
    ;
    const webSocketDetails = await (0, hangoutWebSocketAuth_1.authenticateHandshake)(req);
    if (!webSocketDetails) {
        socket.write(`HTTP/1.1 ${http_1.default.STATUS_CODES[401]}\r\n\r\n`);
        socket.write('Invalid credentials\r\n');
        socket.end();
        return;
    }
    ;
    hangoutWebSocketServer_1.wss.handleUpgrade(req, socket, head, (ws) => {
        const wsSet = hangoutWebSocketServer_1.wsMap.get(webSocketDetails.hangoutId);
        if (!wsSet) {
            hangoutWebSocketServer_1.wsMap.set(webSocketDetails.hangoutId, new Set([ws]));
            hangoutWebSocketServer_1.wss.emit('connection', ws, req);
            return;
        }
        ;
        wsSet.add(ws);
        hangoutWebSocketServer_1.wss.emit('connection', ws, req);
    });
});
async function initServer() {
    try {
        await (0, initDb_1.initDb)();
        server.listen(port, () => {
            console.log(`Server running on port ${port}.`);
        });
        (0, cronInit_1.initCronJobs)();
    }
    catch (err) {
        console.log(err);
        process.exit(1);
    }
    ;
}
;
initServer();
