export const minuteMilliseconds: number = 1000 * 60;
export const hourMilliseconds: number = minuteMilliseconds * 60;
export const dayMilliseconds: number = hourMilliseconds * 24;

export const FAILED_SIGN_IN_LIMIT: number = 5;
export const FAILED_ACCOUNT_UPDATE_LIMIT: number = 3;
export const EMAILS_SENT_LIMIT: number = 3;

export const ACCOUNT_VERIFICATION_WINDOW: number = minuteMilliseconds * 20;
export const ACCOUNT_RECOVERY_WINDOW: number = hourMilliseconds;
export const ACCOUNT_DELETION_WINDOW: number = hourMilliseconds;
export const ACCOUNT_DELETION_SUSPENSION_WINDOW: number = dayMilliseconds;
export const ACCOUNT_EMAIL_UPDATE_WINDOW: number = dayMilliseconds;
export const MAX_ONGOING_HANGOUTS_LIMIT: number = 12;

export const MAX_HANGOUT_MEMBERS_LIMIT: number = 20;
export const MIN_HANGOUT_MEMBERS_LIMIT: number = 2;

export const MIN_HANGOUT_PERIOD_DAYS: number = 1;
export const MAX_HANGOUT_PERIOD_DAYS: number = 7;

export const HANGOUT_VOTES_LIMIT: number = 3;
export const HANGOUT_SUGGESTIONS_LIMIT: number = 3;
export const HANGOUT_AVAILABILITY_SLOTS_LIMIT: number = 10;

export const HANGOUT_AVAILABILITY_STAGE: number = 1;
export const HANGOUT_SUGGESTIONS_STAGE: number = 2;
export const HANGOUT_VOTING_STAGE: number = 3;
export const HANGOUT_CONCLUSION_STAGE: number = 4;