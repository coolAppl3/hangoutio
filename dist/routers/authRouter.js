"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = __importDefault(require("express"));
const cookieUtils_1 = require("../util/cookieUtils");
const authSessions_1 = require("../auth/authSessions");
exports.authRouter = express_1.default.Router();
exports.authRouter.post('/signOut', async (req, res) => {
    const authSessionId = (0, cookieUtils_1.getRequestCookie)(req, 'authSessionId');
    if (!authSessionId) {
        res.status(409).json({ message: 'Not signed in.' });
        return;
    }
    ;
    try {
        (0, cookieUtils_1.removeRequestCookie)(res, 'authSessionId');
        await (0, authSessions_1.destroyAuthSession)(authSessionId);
        res.json({});
    }
    catch (err) {
        console.log(err);
        if (res.headersSent) {
            return;
        }
        ;
        res.status(500).json({ message: 'Internal server error.' });
    }
    ;
});
