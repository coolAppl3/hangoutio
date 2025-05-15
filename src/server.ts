import http, { IncomingMessage } from 'http';
import { wsMap, wss } from './webSockets/hangout/hangoutWebSocketServer';
import { Socket } from 'net';
import { WebSocket } from 'ws';
import { app } from "./app";
import { authenticateHandshake } from './webSockets/hangout/hangoutWebSocketAuth';
import { initDb } from "./db/initDb";
import { initCronJobs } from "./cron-jobs/cronInit";

const port: number = process.env.PORT ? +process.env.PORT : 5000;
const server = http.createServer(app);

// websocket upgrade
server.on('upgrade', async (req: IncomingMessage, socket: Socket, head: Buffer) => {
  socket.on('error', (err) => {
    if (('errno' in err) && err.errno === -4077) {
      socket.end();
      return;
    };

    console.log(err, err.stack)

    socket.write(`HTTP/1.1 ${http.STATUS_CODES[500]}\r\n\r\n`);
    socket.write('Internal server error\r\n');

    socket.end();
  });

  const memoryUsageMegabytes: number = process.memoryUsage().rss / Math.pow(1024, 2);
  const memoryThreshold: number = +(process.env.WS_ALLOW_MEMORY_THRESHOLD_MB || 500);

  if (memoryUsageMegabytes >= memoryThreshold) {
    socket.write(`HTTP/1.1 ${http.STATUS_CODES[509]}\r\n\r\n`);
    socket.write('Temporarily unavailable\r\n');

    socket.end();
    return;
  };

  const webSocketDetails: { hangoutMemberId: number, hangoutId: string } | null = await authenticateHandshake(req);

  if (!webSocketDetails) {
    socket.write(`HTTP/1.1 ${http.STATUS_CODES[401]}\r\n\r\n`);
    socket.write('Invalid credentials\r\n');

    socket.end();
    return;
  };

  wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
    const wsSet: Set<WebSocket> | undefined = wsMap.get(webSocketDetails.hangoutId);

    if (!wsSet) {
      wsMap.set(webSocketDetails.hangoutId, new Set([ws]));
      wss.emit('connection', ws, req);

      return;
    };

    wsSet.add(ws);
    wss.emit('connection', ws, req);
  });
});

// init
async function initServer(): Promise<void> {
  try {
    await initDb();
    server.listen(port, () => {
      console.log(`Server running on port ${port}.`)
    });

    initCronJobs();

  } catch (err: unknown) {
    console.log(err);
    process.exit(1);
  };
};

initServer();