"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const accountCronJobs = __importStar(require("./accountCronJobs"));
const hangoutCronJobs = __importStar(require("./hangoutCronJobs"));
const cleanHangoutClients_1 = require("../webSockets/hangout/cleanHangoutClients");
const authCronJobs_1 = require("./authCronJobs");
function initCronJobs() {
    node_cron_1.default.schedule('* * * * *', async () => {
        (0, cleanHangoutClients_1.cleanHangoutClients)();
        await accountCronJobs.removeUnverifiedAccounts();
        await accountCronJobs.removeExpiredRecoveryRequests();
        await accountCronJobs.removeExpiredEmailUpdateRequests();
        await hangoutCronJobs.progressHangouts();
        await hangoutCronJobs.concludeNoSuggestionHangouts();
    });
    node_cron_1.default.schedule('*/10 * * * *', async () => {
        await (0, authCronJobs_1.clearExpiredAuthSessions)();
    });
    node_cron_1.default.schedule('0 * * * *', async () => {
        await accountCronJobs.deleteMarkedAccounts();
        await hangoutCronJobs.deleteNoMemberHangouts();
        await hangoutCronJobs.archiveHangouts();
    });
    console.log('CRON jobs started.');
}
exports.initCronJobs = initCronJobs;
;
