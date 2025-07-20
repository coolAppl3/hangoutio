"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const hangoutWebSocketAuth_1 = require("./webSockets/hangout/hangoutWebSocketAuth");
const initDb_1 = require("./db/initDb");
const cronInit_1 = require("./cron-jobs/cronInit");
const port = process.env.PORT ? +process.env.PORT : 5000;
const server = http_1.default.createServer(app_1.app);
server.on('upgrade', async (req, socket, head) => await (0, hangoutWebSocketAuth_1.handleWebSocketUpgrade)(req, socket, head));
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
