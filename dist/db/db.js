"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbPool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const constants_1 = require("../util/constants");
exports.dbPool = promise_1.default.createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASS,
    database: process.env.DATABASE_NAME,
    waitForConnections: true,
    connectionLimit: 50,
    idleTimeout: constants_1.minuteMilliseconds * 5,
    queueLimit: 100,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    multipleStatements: true,
    namedPlaceholders: true,
});
