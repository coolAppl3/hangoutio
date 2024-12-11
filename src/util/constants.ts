const minuteMilliseconds: number = 1000 * 60;
const hourMilliseconds: number = minuteMilliseconds * 60;
const dayMilliseconds: number = hourMilliseconds * 24;

export const FAILED_SIGN_IN_LIMIT = 5;
export const FAILED_ACCOUNT_UPDATE_LIMIT = 3;
export const EMAILS_SENT_LIMIT = 3;

export const ACCOUNT_VERIFICATION_WINDOW = minuteMilliseconds * 20;
export const ACCOUNT_RECOVERY_WINDOW = hourMilliseconds;
export const ACCOUNT_DELETION_WINDOW = hourMilliseconds;
export const ACCOUNT_DELETION_SUSPENSION_WINDOW = dayMilliseconds;
export const ACCOUNT_EMAIL_UPDATE_WINDOW = dayMilliseconds;

export const HANGOUT_MEMBERS_LIMIT = 20;
export const ONGOING_HANGOUTS_LIMIT = 12;

export const HANGOUT_VOTES_LIMIT = 3;
export const HANGOUT_SUGGESTIONS_LIMIT = 3;
export const HANGOUT_AVAILABILITY_SLOTS_LIMIT = 10;

export const HANGOUT_AVAILABILITY_STEP = 1;
export const HANGOUT_SUGGESTIONS_STEP = 2;
export const HANGOUT_VOTING_STEP = 3;
export const HANGOUT_CONCLUSION_STEP = 4;