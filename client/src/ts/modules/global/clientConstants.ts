export const minuteMilliseconds: number = 1000 * 60;
export const hourMilliseconds: number = minuteMilliseconds * 60;
export const dayMilliseconds: number = hourMilliseconds * 24;

export const EMAILS_SENT_LIMIT: number = 3;

export const MAX_HANGOUT_MEMBERS_LIMIT: number = 20;
export const MIN_HANGOUT_MEMBERS_LIMIT: number = 2;

export const MIN_HANGOUT_PERIOD_DAYS: number = 1;
export const MAX_HANGOUT_PERIOD_DAYS: number = 7;

export const HANGOUT_AVAILABILITY_STAGE: number = 1;
export const HANGOUT_SUGGESTIONS_STAGE: number = 2;
export const HANGOUT_VOTING_STAGE: number = 3;
export const HANGOUT_CONCLUSION_STAGE: number = 4;

export const HANGOUT_VOTES_LIMIT: number = 3;
export const HANGOUT_SUGGESTIONS_LIMIT: number = 3;
export const HANGOUT_AVAILABILITY_SLOTS_LIMIT: number = 10;

export const HANGOUT_CHAT_FETCH_BATCH_SIZE: number = 30;
export const ACCOUNT_HANGOUT_HISTORY_FETCH_BATCH_SIZE: number = 10;
export const ACCOUNT_FRIENDS_FETCH_BATCH_SIZE: number = 10;
export const HANGOUT_INVITES_FETCH_BATCH_SIZE: number = 10;