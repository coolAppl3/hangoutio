"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePlaceHolders = void 0;
function generatePlaceHolders(numberOfPlaceHolders) {
    let placeHolderString = '';
    for (let i = 0; i < numberOfPlaceHolders; i++) {
        if (i + 1 === numberOfPlaceHolders) {
            placeHolderString += '?';
            continue;
        }
        ;
        placeHolderString += '?, ';
    }
    ;
    return placeHolderString;
}
exports.generatePlaceHolders = generatePlaceHolders;
;
