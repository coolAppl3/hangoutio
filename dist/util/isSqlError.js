"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSqlError = void 0;
function isSqlError(err) {
    if (typeof err !== 'object' || err === null) {
        return false;
    }
    ;
    if (!('sql' in err)) {
        return false;
    }
    ;
    if (!err.sql || typeof err.sql !== 'string') {
        return false;
    }
    ;
    return true;
}
exports.isSqlError = isSqlError;
;
