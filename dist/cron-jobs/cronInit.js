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
const authCronJobs_1 = require("./authCronJobs");
const guestCronJobs_1 = require("./guestCronJobs");
const hangoutWebSocketServer_1 = require("../webSockets/hangout/hangoutWebSocketServer");
const rateLimiterCronJobs_1 = require("./rateLimiterCronJobs");
const constants_1 = require("../util/constants");
const loggerCronJobs_1 = require("../logs/loggerCronJobs");
function initCronJobs() {
    setInterval(async () => {
        await (0, rateLimiterCronJobs_1.replenishRateRequests)();
    }, constants_1.minuteMilliseconds / 2);
    node_cron_1.default.schedule('* * * * *', async () => {
        await hangoutCronJobs.progressHangouts();
        await hangoutCronJobs.concludeSingleSuggestionHangouts();
        await hangoutCronJobs.concludeNoSuggestionHangouts();
        await accountCronJobs.removeUnverifiedAccounts();
        await accountCronJobs.removeExpiredRecoveryRequests();
        await accountCronJobs.removeExpiredEmailUpdateRequests();
        await accountCronJobs.removeExpiredDeletionRequests();
        await (0, authCronJobs_1.clearExpiredAuthSessions)();
        await (0, rateLimiterCronJobs_1.removeStaleRateTrackerRows)();
        (0, hangoutWebSocketServer_1.removeEmptyHangoutWebSocketSets)();
    });
    node_cron_1.default.schedule('0 * * * *', async () => {
        await hangoutCronJobs.deleteEmptyHangouts();
    });
    node_cron_1.default.schedule('0 0 * * *', async () => {
        await (0, guestCronJobs_1.deleteStaleGuestUsers)();
        await (0, rateLimiterCronJobs_1.removeLightRateAbusers)();
        await (0, loggerCronJobs_1.clearErrorLogs)();
    });
    console.log('CRON jobs started.');
}
exports.initCronJobs = initCronJobs;
;
