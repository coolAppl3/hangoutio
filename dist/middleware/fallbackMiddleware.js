"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fallbackMiddleware = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
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
    const htmlFilePath = path_1.default.join(__dirname, '../../public/errorPages', `${errCode}.html`);
    if (!fs_1.default.existsSync(htmlFilePath)) {
        res.status(errCode).json({ success: false, message: 'Page not found.' });
        return;
    }
    ;
    res.status(errCode).sendFile(htmlFilePath);
}
;
