"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.undefinedValuesDetected = void 0;
;
function undefinedValuesDetected(requestData, expectedKeys) {
    if (Object.keys(requestData).length !== expectedKeys.length) {
        return true;
    }
    ;
    for (const key of expectedKeys) {
        if (requestData[key] === undefined) {
            return true;
        }
        ;
    }
    ;
    return false;
}
exports.undefinedValuesDetected = undefinedValuesDetected;
;
