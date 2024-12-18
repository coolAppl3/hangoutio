export const minuteMilliseconds: number = 1000 * 60;
export const hourMilliseconds: number = minuteMilliseconds * 60;
export const dayMilliseconds: number = hourMilliseconds * 24;

export const FAILED_SIGN_IN_LIMIT = 5;
export const FAILED_ACCOUNT_UPDATE_LIMIT = 3;
export const EMAILS_SENT_LIMIT = 3;

export const ACCOUNT_VERIFICATION_WINDOW = minuteMilliseconds * 20;
export const ACCOUNT_RECOVERY_WINDOW = hourMilliseconds;
export const ACCOUNT_DELETION_WINDOW = hourMilliseconds;
export const ACCOUNT_DELETION_SUSPENSION_WINDOW = dayMilliseconds;
export const ACCOUNT_EMAIL_UPDATE_WINDOW = dayMilliseconds;
export const MAX_ONGOING_HANGOUTS_LIMIT = 12;

export const MAX_HANGOUT_MEMBERS_LIMIT = 20;
export const MIN_HANGOUT_MEMBERS_LIMIT = 2;

export const MIN_HANGOUT_PERIOD_DAYS = 1;
export const MAX_HANGOUT_PERIOD_DAYS = 7;

export const HANGOUT_VOTES_LIMIT = 3;
export const HANGOUT_SUGGESTIONS_LIMIT = 3;
export const HANGOUT_AVAILABILITY_SLOTS_LIMIT = 10;

export const HANGOUT_AVAILABILITY_STAGE = 1;
export const HANGOUT_SUGGESTIONS_STAGE = 2;
export const HANGOUT_VOTING_STAGE = 3;
export const HANGOUT_CONCLUSION_STAGE = 4;