import mysql, { Pool } from 'mysql2/promise';

export const dbPool: Pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASS,
  database: process.env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 50,
  idleTimeout: 1000 * 60 * 5,
  queueLimit: 50,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  multipleStatements: true,
  namedPlaceholders: true,
});