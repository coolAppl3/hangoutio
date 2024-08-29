"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentStepName = exports.getNextStepTimestamp = exports.getConclusionTimestamp = exports.hangoutStepsMap = void 0;
exports.hangoutStepsMap = new Map();
exports.hangoutStepsMap.set(1, 'availability_step');
exports.hangoutStepsMap.set(2, 'suggestions_step');
exports.hangoutStepsMap.set(3, 'voting_step');
function getConclusionTimestamp(createdOnTimestamp, availabilityStep, suggestionsStep, votingStep) {
    const conclusionTimestamp = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;
    return conclusionTimestamp;
}
exports.getConclusionTimestamp = getConclusionTimestamp;
;
function getNextStepTimestamp(currentStep, currentStepTimestamp, availabilityStep, suggestionsStep, votingStep) {
    if (currentStep === 1) {
        return currentStepTimestamp + availabilityStep;
    }
    ;
    if (currentStep === 2) {
        return currentStepTimestamp + suggestionsStep;
    }
    ;
    if (currentStep === 3) {
        return currentStepTimestamp + votingStep;
    }
    ;
    const weekMilliseconds = 1000 * 60 * 60 * 24 * 7;
    return currentStepTimestamp + weekMilliseconds;
}
exports.getNextStepTimestamp = getNextStepTimestamp;
;
function getCurrentStepName(currentStep) {
    const steps = ['availability', 'suggestions', 'voting'];
    const currentStepName = steps[--currentStep];
    return currentStepName;
}
exports.getCurrentStepName = getCurrentStepName;
;
