"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fallbackMiddleware = void 0;
const path_1 = __importDefault(require("path"));
function fallbackMiddleware(req, res) {
    const acceptsHtml = req.headers.accept?.includes('text/html') === true;
    if (acceptsHtml) {
        sendBrowserResponse(res, 404);
        return;
    }
    ;
    res.status(404).json({ success: false, message: 'Resource not found.' });
}
exports.fallbackMiddleware = fallbackMiddleware;
;
function sendBrowserResponse(res, errCode) {
    const errorPagePath = path_1.default.join(__dirname, '../../public/errorPages', `${errCode}.html`);
    res.status(errCode).sendFile(errorPagePath, (err) => {
        if (!err) {
            return;
        }
        ;
        res.status(500).send('Internal server error.');
    });
}
;
