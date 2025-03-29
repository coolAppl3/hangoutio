"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HANGOUT_CHAT_FETCH_CHUNK_SIZE = exports.HANGOUT_CONCLUSION_STAGE = exports.HANGOUT_VOTING_STAGE = exports.HANGOUT_SUGGESTIONS_STAGE = exports.HANGOUT_AVAILABILITY_STAGE = exports.HANGOUT_AVAILABILITY_SLOTS_LIMIT = exports.HANGOUT_SUGGESTIONS_LIMIT = exports.HANGOUT_VOTES_LIMIT = exports.MAX_HANGOUT_PERIOD_DAYS = exports.MIN_HANGOUT_PERIOD_DAYS = exports.MIN_HANGOUT_MEMBERS_LIMIT = exports.MAX_HANGOUT_MEMBERS_LIMIT = exports.MAX_ONGOING_HANGOUTS_LIMIT = exports.ACCOUNT_EMAIL_UPDATE_WINDOW = exports.ACCOUNT_DELETION_SUSPENSION_WINDOW = exports.ACCOUNT_DELETION_WINDOW = exports.ACCOUNT_RECOVERY_WINDOW = exports.ACCOUNT_VERIFICATION_WINDOW = exports.EMAILS_SENT_LIMIT = exports.FAILED_ACCOUNT_UPDATE_LIMIT = exports.FAILED_SIGN_IN_LIMIT = exports.dayMilliseconds = exports.hourMilliseconds = exports.minuteMilliseconds = void 0;
exports.minuteMilliseconds = 1000 * 60;
exports.hourMilliseconds = exports.minuteMilliseconds * 60;
exports.dayMilliseconds = exports.hourMilliseconds * 24;
exports.FAILED_SIGN_IN_LIMIT = 5;
exports.FAILED_ACCOUNT_UPDATE_LIMIT = 3;
exports.EMAILS_SENT_LIMIT = 3;
exports.ACCOUNT_VERIFICATION_WINDOW = exports.minuteMilliseconds * 20;
exports.ACCOUNT_RECOVERY_WINDOW = exports.hourMilliseconds;
exports.ACCOUNT_DELETION_WINDOW = exports.hourMilliseconds;
exports.ACCOUNT_DELETION_SUSPENSION_WINDOW = exports.dayMilliseconds;
exports.ACCOUNT_EMAIL_UPDATE_WINDOW = exports.dayMilliseconds;
exports.MAX_ONGOING_HANGOUTS_LIMIT = 12;
exports.MAX_HANGOUT_MEMBERS_LIMIT = 20;
exports.MIN_HANGOUT_MEMBERS_LIMIT = 2;
exports.MIN_HANGOUT_PERIOD_DAYS = 1;
exports.MAX_HANGOUT_PERIOD_DAYS = 7;
exports.HANGOUT_VOTES_LIMIT = 3;
exports.HANGOUT_SUGGESTIONS_LIMIT = 3;
exports.HANGOUT_AVAILABILITY_SLOTS_LIMIT = 10;
exports.HANGOUT_AVAILABILITY_STAGE = 1;
exports.HANGOUT_SUGGESTIONS_STAGE = 2;
exports.HANGOUT_VOTING_STAGE = 3;
exports.HANGOUT_CONCLUSION_STAGE = 4;
exports.HANGOUT_CHAT_FETCH_CHUNK_SIZE = 30;
