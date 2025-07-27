import mysql, { Pool } from 'mysql2/promise';

export const dbPool: Pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASS,
  database: process.env.DATABASE_NAME,
  connectionLimit: 50,
  maxIdle: 20,
  idleTimeout: 80 * 1000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 20 * 1000,
  waitForConnections: true,
  queueLimit: 10,
  multipleStatements: true,
  namedPlaceholders: true,
});