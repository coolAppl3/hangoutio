import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import cors from 'cors';
import express, { Application } from 'express';

// routers
import { accountsRouter } from './routes/accounts';
import { hangoutsRouter } from './routes/hangouts';
import { guestsRouter } from './routes/guests';
import { hangoutMembersRouter } from './routes/hangoutMembers';
import { initCronJobs } from './cron-jobs/cronInit';

const port = process.env.PORT || 5000;
const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// cors policy
if (process.env.NODE_ENV === 'development') {
  const whitelist = ['http://localhost:3000', 'http://localhost:5000', 'http://46.240.183.31:3000', '46.240.183.31:3000', 'http://46.240.183.31:5000', '46.240.183.31:5000'];

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

// cron-jobs
initCronJobs();

// init
app.listen(port, () => {
  console.log(`Server running on port ${port}.`)
});