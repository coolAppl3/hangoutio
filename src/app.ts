import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import cors from 'cors';
import express, { Application, Request, Response } from 'express';

// routers
import { accountsRouter } from './routes/accounts';
import { hangoutsRouter } from './routes/hangouts';
import { guestsRouter } from './routes/guests';
import { hangoutMembersRouter } from './routes/hangoutMembers';
import { availabilitySlotsRouter } from './routes/availabilitySlots';
import { suggestionsRouter } from './routes/suggestions';
import { votesRouter } from './routes/votes';

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

// static files
app.use(express.static(path.join(__dirname, '../public')));

// routes
app.use('/api/accounts', accountsRouter);
app.use('/api/hangouts', hangoutsRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/hangoutMembers', hangoutMembersRouter);
app.use('/api/availabilitySlots', availabilitySlotsRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/votes', votesRouter);

// catch-all middleware
app.use((req: Request, res: Response) => {
  res.status(403).json({ success: false, message: 'Access denied.' });
});

// cron-jobs
initCronJobs();

// init
app.listen(port, () => {
  console.log(`Server running on port ${port}.`)
});