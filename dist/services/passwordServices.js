"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHashedPassword = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const saltRounds = 10;
async function getHashedPassword(res, plainPassword) {
    try {
        const hashedPassword = await bcrypt_1.default.hash(plainPassword, saltRounds);
        return hashedPassword;
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
        return '';
    }
    ;
}
exports.getHashedPassword = getHashedPassword;
;
