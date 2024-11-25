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
const initDb_1 = require("./db/initDb");
const chat_1 = require("./routers/chat");
const accounts_1 = require("./routers/accounts");
const hangouts_1 = require("./routers/hangouts");
const guests_1 = require("./routers/guests");
const hangoutMembers_1 = require("./routers/hangoutMembers");
const availabilitySlots_1 = require("./routers/availabilitySlots");
const suggestions_1 = require("./routers/suggestions");
const votes_1 = require("./routers/votes");
const htmlRouter_1 = require("./routers/htmlRouter");
const fallbackMiddleware_1 = require("./middleware/fallbackMiddleware");
const cronInit_1 = require("./cron-jobs/cronInit");
const hangoutWebSocketAuth_1 = require("./webSockets/hangout/hangoutWebSocketAuth");
const port = process.env.PORT || 5000;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
app.use((0, compression_1.default)({ threshold: 1024 }));
if (process.env.NODE_ENV === 'development') {
    const whitelist = ['http://localhost:3000', 'http://localhost:5000'];
    app.use((0, cors_1.default)({
        origin: whitelist,
        credentials: true,
    }));
}
;
app.use('/api/chat', chat_1.chatRouter);
app.use('/api/accounts', accounts_1.accountsRouter);
app.use('/api/hangouts', hangouts_1.hangoutsRouter);
app.use('/api/guests', guests_1.guestsRouter);
app.use('/api/hangoutMembers', hangoutMembers_1.hangoutMembersRouter);
app.use('/api/availabilitySlots', availabilitySlots_1.availabilitySlotsRouter);
app.use('/api/suggestions', suggestions_1.suggestionsRouter);
app.use('/api/votes', votes_1.votesRouter);
app.use(htmlRouter_1.htmlRouter);
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
app.use(fallbackMiddleware_1.fallbackMiddleware);
const server = http_1.default.createServer(app);
server.on('upgrade', async (req, socket, head) => {
    const requestData = await (0, hangoutWebSocketAuth_1.authenticateHandshake)(req);
    if (!requestData) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.write('Invalid credentials\r\n');
        socket.destroy();
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
