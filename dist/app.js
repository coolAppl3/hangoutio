"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const hangoutWebSocketServer_1 = require("./webSockets/hangout/hangoutWebSocketServer");
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const initDb_1 = require("./db/initDb");
const chatRouter_1 = require("./routers/chatRouter");
const accountsRouter_1 = require("./routers/accountsRouter");
const hangoutsRouter_1 = require("./routers/hangoutsRouter");
const guestsRouter_1 = require("./routers/guestsRouter");
const hangoutMembersRouter_1 = require("./routers/hangoutMembersRouter");
const availabilitySlotsRouter_1 = require("./routers/availabilitySlotsRouter");
const suggestionsRouter_1 = require("./routers/suggestionsRouter");
const votesRouter_1 = require("./routers/votesRouter");
const htmlRouter_1 = require("./routers/htmlRouter");
const authRouter_1 = require("./routers/authRouter");
const fallbackMiddleware_1 = require("./middleware/fallbackMiddleware");
const cronInit_1 = require("./cron-jobs/cronInit");
const hangoutWebSocketAuth_1 = require("./webSockets/hangout/hangoutWebSocketAuth");
const port = process.env.PORT ? +process.env.PORT : 5000;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
app.use((0, compression_1.default)({ threshold: 1024 }));
app.use((0, cookie_parser_1.default)());
if (process.env.NODE_ENV === 'development') {
    const whitelist = ['http://localhost:3000', 'http://localhost:5000'];
    app.use((0, cors_1.default)({
        origin: whitelist,
        credentials: true,
    }));
}
;
app.use('/api/chat', chatRouter_1.chatRouter);
app.use('/api/accounts', accountsRouter_1.accountsRouter);
app.use('/api/hangouts', hangoutsRouter_1.hangoutsRouter);
app.use('/api/guests', guestsRouter_1.guestsRouter);
app.use('/api/hangoutMembers', hangoutMembersRouter_1.hangoutMembersRouter);
app.use('/api/availabilitySlots', availabilitySlotsRouter_1.availabilitySlotsRouter);
app.use('/api/suggestions', suggestionsRouter_1.suggestionsRouter);
app.use('/api/votes', votesRouter_1.votesRouter);
app.use('/api/auth', authRouter_1.authRouter);
app.use(htmlRouter_1.htmlRouter);
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
app.use(fallbackMiddleware_1.fallbackMiddleware);
const server = http_1.default.createServer(app);
server.on('upgrade', async (req, socket, head) => {
    socket.on('error', (err) => {
        console.log(err);
        socket.write(`HTTP/1.1 ${http_1.default.STATUS_CODES[500]}\r\n\r\n`);
        socket.write('Internal server error\r\n');
        socket.end();
    });
    const memoryUsageMegabytes = process.memoryUsage().rss / Math.pow(1024, 2);
    const memoryThreshold = +(process.env.WS_ALLOW_MEMORY_THRESHOLD_MB || 500);
    if (memoryUsageMegabytes >= memoryThreshold) {
        socket.write(`HTTP/1.1 ${http_1.default.STATUS_CODES[509]}\r\n\r\n`);
        socket.write('Temporarily unavailable\r\n');
        socket.end();
        return;
    }
    ;
    const requestData = await (0, hangoutWebSocketAuth_1.authenticateHandshake)(req);
    if (!requestData) {
        socket.write(`HTTP/1.1 ${http_1.default.STATUS_CODES[401]}\r\n\r\n`);
        socket.write('Invalid credentials\r\n');
        socket.end();
        return;
    }
    ;
    hangoutWebSocketServer_1.wss.handleUpgrade(req, socket, head, (ws) => {
        hangoutWebSocketServer_1.wss.emit('connection', ws, req);
        (0, hangoutWebSocketServer_1.insertIntoHangoutClients)(requestData.hangoutId, requestData.hangoutMemberId, ws);
    });
});
async function initServer() {
    try {
        await (0, initDb_1.initDb)();
        server.listen(port, () => {
            console.log(`Server running on port ${port}.`);
        });
        (0, cronInit_1.initCronJobs)();
    }
    catch (err) {
        console.log(err);
        process.exit(1);
    }
    ;
}
;
initServer();
