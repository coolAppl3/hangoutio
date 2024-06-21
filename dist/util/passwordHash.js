"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const saltRounds = 10;
async function hashPassword(plainPassword) {
    try {
        const hashedPassword = await bcrypt_1.default.hash(plainPassword, saltRounds);
        return hashedPassword;
    }
    catch (err) {
        console.log(err);
        return '';
    }
    ;
}
exports.hashPassword = hashPassword;
;
