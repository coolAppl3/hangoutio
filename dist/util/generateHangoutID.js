"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const allowedCharacters = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789';
const tokenLength = allowedCharacters.length;
function generateHangoutID() {
    let hangoutID = 'h';
    while (hangoutID.length < 32) {
        hangoutID += allowedCharacters[Math.floor(Math.random() * tokenLength)];
    }
    ;
    return hangoutID;
}
exports.default = generateHangoutID;
;
