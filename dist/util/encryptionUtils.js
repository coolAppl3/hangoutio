"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptPassword = exports.encryptPassword = void 0;
const crypto_1 = __importDefault(require("crypto"));
function encryptPassword(password) {
    const encryptionKeyHex = process.env.ENCRYPTION_KEY;
    if (!encryptionKeyHex) {
        return null;
    }
    ;
    const encryptionKeyBuffer = Buffer.from(encryptionKeyHex, 'hex');
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv('aes-256-cbc', encryptionKeyBuffer, iv);
    let encryptedPassword = cipher.update(password, 'utf8', 'hex');
    encryptedPassword += cipher.final('hex');
    const storableEncryptedPassword = `${iv.toString('hex')}-${encryptedPassword}`;
    return storableEncryptedPassword;
}
exports.encryptPassword = encryptPassword;
;
function decryptPassword(storedEncryptedPassword) {
    const encryptionKeyHex = process.env.ENCRYPTION_KEY;
    if (!encryptionKeyHex) {
        return null;
    }
    ;
    const [storedIvHex, encryptedPassword] = storedEncryptedPassword.split('-');
    if (!storedIvHex || !encryptedPassword) {
        return null;
    }
    ;
    const ivBuffer = Buffer.from(storedIvHex, 'hex');
    const encryptionKeyBuffer = Buffer.from(encryptionKeyHex, 'hex');
    const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', encryptionKeyBuffer, ivBuffer);
    let decryptedPassword = decipher.update(encryptedPassword, 'hex', 'utf8');
    decryptedPassword += decipher.final('utf8');
    return decryptedPassword;
}
exports.decryptPassword = decryptPassword;
;
