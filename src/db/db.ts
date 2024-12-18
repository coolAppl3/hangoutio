import mysql, { Pool } from 'mysql2/promise';
import { minuteMilliseconds } from '../util/constants';

export const dbPool: Pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASS,
  database: process.env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 50,
  idleTimeout: minuteMilliseconds * 5,
  queueLimit: 100,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  multipleStatements: true,
  namedPlaceholders: true,
});