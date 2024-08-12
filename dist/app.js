"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const accounts_1 = require("./routes/accounts");
const hangouts_1 = require("./routes/hangouts");
const guests_1 = require("./routes/guests");
const hangoutMembers_1 = require("./routes/hangoutMembers");
const cronInit_1 = require("./cron-jobs/cronInit");
const port = process.env.PORT || 5000;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
if (process.env.NODE_ENV === 'development') {
    const whitelist = ['http://localhost:3000', 'http://localhost:5000', 'http://46.240.183.31:3000', '46.240.183.31:3000', 'http://46.240.183.31:5000', '46.240.183.31:5000'];
    app.use((0, cors_1.default)({
        origin: whitelist,
        credentials: true,
    }));
}
;
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
app.use('/api/accounts', accounts_1.accountsRouter);
app.use('/api/hangouts', hangouts_1.hangoutsRouter);
app.use('/api/guests', guests_1.guestsRouter);
app.use('/api/hangoutMembers', hangoutMembers_1.hangoutMembersRouter);
(0, cronInit_1.initCronJobs)();
app.listen(port, () => {
    console.log(`Server running on port ${port}.`);
});
