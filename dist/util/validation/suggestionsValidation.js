"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSuggestionDescription = exports.isValidSuggestionTitle = void 0;
const titleRegex = /^[a-zA-Z0-9]{1,50}$/;
const descriptionRegex = /^.{0,500}$/s;
function isValidSuggestionTitle(title) {
    if (typeof title !== 'string') {
        return false;
    }
    ;
    return titleRegex.test(title);
}
exports.isValidSuggestionTitle = isValidSuggestionTitle;
;
function isValidSuggestionDescription(description) {
    if (typeof description !== 'string') {
        return false;
    }
    ;
    return descriptionRegex.test(description);
}
exports.isValidSuggestionDescription = isValidSuggestionDescription;
;
