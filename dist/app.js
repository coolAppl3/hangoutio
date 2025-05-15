"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
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
const rateLimiter_1 = require("./middleware/rateLimiter");
exports.app = (0, express_1.default)();
exports.app.use(express_1.default.json());
exports.app.use(express_1.default.urlencoded({ extended: false }));
exports.app.use((0, compression_1.default)({ threshold: 1024 }));
exports.app.use((0, cookie_parser_1.default)());
if (process.env.NODE_ENV?.toLowerCase() === 'development') {
    const whitelist = ['http://localhost:3000', 'http://localhost:5000'];
    exports.app.use((0, cors_1.default)({
        origin: whitelist,
        credentials: true,
    }));
}
;
exports.app.use((req, res, next) => {
    const stagingHostName = process.env.STAGING_HOST_NAME;
    res.set('Content-Security-Policy', `default-src 'self'; script-src 'self'; connect-src 'self' wss://www.hangoutio.com${stagingHostName ? ` wss://${stagingHostName}` : ''};`);
    next();
});
exports.app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
exports.app.use(htmlRouter_1.htmlRouter);
exports.app.use('/api/', rateLimiter_1.rateLimiter);
exports.app.use('/api/chat', chatRouter_1.chatRouter);
exports.app.use('/api/accounts', accountsRouter_1.accountsRouter);
exports.app.use('/api/hangouts', hangoutsRouter_1.hangoutsRouter);
exports.app.use('/api/guests', guestsRouter_1.guestsRouter);
exports.app.use('/api/hangoutMembers', hangoutMembersRouter_1.hangoutMembersRouter);
exports.app.use('/api/availabilitySlots', availabilitySlotsRouter_1.availabilitySlotsRouter);
exports.app.use('/api/suggestions', suggestionsRouter_1.suggestionsRouter);
exports.app.use('/api/votes', votesRouter_1.votesRouter);
exports.app.use('/api/auth', authRouter_1.authRouter);
exports.app.use(fallbackMiddleware_1.fallbackMiddleware);
