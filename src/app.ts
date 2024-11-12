import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import cors from 'cors';
import http, { IncomingMessage } from 'http';
import { insertIntoHangoutClients, wss } from './webSockets/hangout/hangoutWebSocketServer';
import { Socket } from 'net';
import { WebSocket } from 'ws';
import express, { Application } from 'express';
import compression from 'compression';

import { initDb } from './db/initDb';

// routers
import { chatRouter } from './routes/chat';
import { accountsRouter } from './routes/accounts';
import { hangoutsRouter } from './routes/hangouts';
import { guestsRouter } from './routes/guests';
import { hangoutMembersRouter } from './routes/hangoutMembers';
import { availabilitySlotsRouter } from './routes/availabilitySlots';
import { suggestionsRouter } from './routes/suggestions';
import { votesRouter } from './routes/votes';

// middleware
import { fallbackMiddleware } from './middleware/fallbackMiddleware';

// other
import { initCronJobs } from './cron-jobs/cronInit';
import { authenticateHandshake } from './webSockets/hangout/hangoutWebSocketAuth';

const port = process.env.PORT || 5000;
const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(compression());

// cors policy
if (process.env.NODE_ENV === 'development') {
  const whitelist = ['http://localhost:3000', 'http://localhost:5000'];

  app.use(
    cors({
      origin: whitelist,
      credentials: true,
    })
  );
};

// routes
app.use('/api/chat', chatRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/hangouts', hangoutsRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/hangoutMembers', hangoutMembersRouter);
app.use('/api/availabilitySlots', availabilitySlotsRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/votes', votesRouter);

// static files
app.use(express.static(path.join(__dirname, '../public')));

// fallback middleware
app.use(fallbackMiddleware);

const server = http.createServer(app);

server.on('upgrade', async (req: IncomingMessage, socket: Socket, head: Buffer) => {
  const requestData: { hangoutId: string, hangoutMemberId: number } | null = await authenticateHandshake(req);

  if (!requestData) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.write('Invalid credentials\r\n');

    socket.destroy();
    return;
  };

  wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
    wss.emit('connection', ws, req);
    insertIntoHangoutClients(requestData.hangoutId, requestData.hangoutMemberId, ws);
  });
});

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