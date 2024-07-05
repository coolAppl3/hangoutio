import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

export const emailTransporter = nodemailer.createTransport({
  host: process.env.TRANSPORTER_HOST,
  port: process.env.TRANSPORTER_PORT,
  secure: true,
  auth: {
    user: process.env.TRANSPORTER_USER,
    pass: process.env.TRANSPORTER_PASS,
  },
  pool: true,
  maxConnections: 10,
  maxMessages: 100,
} as SMTPTransport.Options);