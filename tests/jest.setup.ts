require('dotenv').config();
import { Request, Response, NextFunction } from 'express';

process.env.DATABASE_NAME = process.env.TEST_DATABASE_NAME;
process.env.PORT = '6000';

jest.mock('../src/middleware/rateLimiter', () => ({
  rateLimiter: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../src/logs/errorLogger', () => ({
  logUnexpectedError: jest.fn(async () => null),
}));

jest.mock('../src/util/email/emailServices', () => ({
  sendVerificationEmail: jest.fn(async () => null),
  sendRecoveryEmail: jest.fn(async () => null),
  sendDeletionConfirmationEmail: jest.fn(async () => null),
  sendDeletionWarningEmail: jest.fn(async () => null),
  sendEmailUpdateEmail: jest.fn(async () => null),
  sendEmailUpdateWarningEmail: jest.fn(async () => null),
}));