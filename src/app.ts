import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import cors from 'cors';
import express, { Application } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';

// routers
import { chatRouter } from './routers/chatRouter';
import { accountsRouter } from './routers/accountsRouter';
import { hangoutsRouter } from './routers/hangoutsRouter';
import { guestsRouter } from './routers/guestsRouter';
import { hangoutMembersRouter } from './routers/hangoutMembersRouter';
import { availabilitySlotsRouter } from './routers/availabilitySlotsRouter';
import { suggestionsRouter } from './routers/suggestionsRouter';
import { votesRouter } from './routers/votesRouter';
import { htmlRouter } from './routers/htmlRouter';
import { authRouter } from './routers/authRouter';

// middleware
import { fallbackMiddleware } from './middleware/fallbackMiddleware';

// other
import { rateLimiter } from './middleware/rateLimiter';

export const app: Application = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(compression({ threshold: 1024 }));
app.use(cookieParser());

// cors policy
if (process.env.NODE_ENV?.toLowerCase() === 'development') {
  const whitelist = ['http://localhost:3000', 'http://localhost:5000'];

  app.use(
    cors({
      origin: whitelist,
      credentials: true,
    })
  );
};

// CSP
app.use((req, res, next) => {
  const stagingHostName: string | undefined = process.env.STAGING_HOST_NAME;
  res.set('Content-Security-Policy', `default-src 'self'; script-src 'self'; connect-src 'self' wss://www.hangoutio.com${stagingHostName ? ` wss://${stagingHostName}` : ''};`);

  next();
});

// static files
app.use(express.static(path.join(__dirname, '../public')));
app.use(htmlRouter);

// rate limiter
app.use('/api/', rateLimiter);

// routes
app.use('/api/chat', chatRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/hangouts', hangoutsRouter);
app.use('/api/guests', guestsRouter);
app.use('/api/hangoutMembers', hangoutMembersRouter);
app.use('/api/availabilitySlots', availabilitySlotsRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/votes', votesRouter);
app.use('/api/auth', authRouter);

// fallback middleware
app.use(fallbackMiddleware);