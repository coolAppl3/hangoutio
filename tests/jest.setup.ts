require('dotenv').config();
import { Request, Response, NextFunction } from 'express';

process.env.DATABASE_NAME = process.env.TEST_DATABASE_NAME;
process.env.PORT = '6000';

jest.mock('../src/middleware/rateLimiter', () => ({
  rateLimiter: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../src/logs/errorLogger', () => ({
  logUnexpectedError: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../src/util/email/initTransporter', () => ({
  sendEmail: jest.fn(() => null),
}));