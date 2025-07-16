import http, { IncomingMessage } from 'http';
import { Socket } from 'net';
import { app } from "./app";
import { handleWebSocketUpgrade } from './webSockets/hangout/hangoutWebSocketAuth';
import { initDb } from "./db/initDb";
import { initCronJobs } from "./cron-jobs/cronInit";

const port: number = process.env.PORT ? +process.env.PORT : 5000;
const server = http.createServer(app);

// websocket upgrade
server.on('upgrade', async (req: IncomingMessage, socket: Socket, head: Buffer) => await handleWebSocketUpgrade(req, socket, head));

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