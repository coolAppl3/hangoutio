"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUnexpectedError = void 0;
const db_1 = require("../db/db");
const generatePlaceHolders_1 = require("../util/generatePlaceHolders");
async function logUnexpectedError(req, err) {
    const currentTimestamp = Date.now();
    const { message, trace } = getErrorData(err);
    try {
        await db_1.dbPool.execute(`INSERT INTO unexpected_errors (
        request_method,
        request_path,
        error_timestamp,
        error_message,
        stack_trace
      ) VALUES (${(0, generatePlaceHolders_1.generatePlaceHolders)(5)});`, [req.method, req.originalUrl, currentTimestamp, message, trace]);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.logUnexpectedError = logUnexpectedError;
;
function getErrorData(err) {
    const errorData = {
        message: null,
        trace: null,
    };
    if (typeof err !== 'object' || err === null) {
        return errorData;
    }
    ;
    if (('message' in err) && typeof err.message === 'string') {
        errorData.message = err.message;
    }
    ;
    if (('trace' in err) && typeof err.trace === 'string') {
        errorData.trace = err.trace;
    }
    ;
    return errorData;
}
;
