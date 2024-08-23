"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailTransporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
exports.emailTransporter = nodemailer_1.default.createTransport({
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
});
