"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidSuggestionDescription = exports.isValidSuggestionTitle = exports.suggestionsLimit = void 0;
exports.suggestionsLimit = 10;
function isValidSuggestionTitle(title) {
    if (typeof title !== 'string') {
        return false;
    }
    ;
    if (title.trim() !== title) {
        return false;
    }
    ;
    const doubleSpacesRemoved = title.split(' ').filter((char) => char !== '').join(' ');
    if (title !== doubleSpacesRemoved) {
        return false;
    }
    ;
    const titleRegex = /^[-A-Za-z0-9 ()!?.]{3,40}$/;
    return titleRegex.test(title);
}
exports.isValidSuggestionTitle = isValidSuggestionTitle;
;
function isValidSuggestionDescription(description) {
    if (typeof description !== 'string') {
        return false;
    }
    ;
    description = description.trim();
    const descriptionRegex = /^[ -~\u20AC\r\n]{10,500}$/;
    return descriptionRegex.test(description);
}
exports.isValidSuggestionDescription = isValidSuggestionDescription;
;
