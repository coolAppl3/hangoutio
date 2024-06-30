"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUnexpectedError = void 0;
;
function logUnexpectedError(req, expectedKeys, result) {
    const unexpectedError = {
        timeStamp: Date.now(),
        request: {
            originalURL: req.originalUrl,
            headers: req.headers,
            body: req.body,
        },
        expectedKeys,
        result,
    };
    console.log(unexpectedError);
}
exports.logUnexpectedError = logUnexpectedError;
;
