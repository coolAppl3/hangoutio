import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import cors from 'cors';
import express, { Application } from 'express';

import { initDb } from './db/initDb';

// routers
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

const port = process.env.PORT || 5000;
const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

async function initServer(): Promise<void> {
  try {
    await initDb();
    console.log('Database initialized.')

    app.listen(port, () => {
      console.log(`Server running on port ${port}.`)
    });

    initCronJobs();

  } catch (err: unknown) {
    console.log(err);
    process.exit(1);
  };
};

initServer();