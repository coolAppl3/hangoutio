"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlRouter = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
exports.htmlRouter = express_1.default.Router();
exports.htmlRouter.get('/:page', async (req, res, next) => {
    const page = req.params.page;
    if (page.includes('.') && !page.endsWith('.html')) {
        next();
        return;
    }
    ;
    const sanitizedPage = path_1.default.basename(page, '.html');
    const filePath = path_1.default.join(__dirname, '../../public', `${sanitizedPage === 'home' ? 'index' : sanitizedPage}.html`);
    res.sendFile(filePath, (err) => {
        if (!err) {
            return;
        }
        ;
        const notFoundPath = path_1.default.join(__dirname, '../../public/errorPages', '404.html');
        res.sendFile(notFoundPath, (fallbackError) => {
            if (!fallbackError) {
                return;
            }
            ;
            res.status(500).send('Internal server error.');
        });
    });
});
