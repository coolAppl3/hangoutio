import { EMAILS_SENT_LIMIT } from "../global/clientConstants";

interface RecoveryState {
  inPasswordUpdateStage: boolean,

  recoveryEmailsSent: number,
  recoveryEmailsSentLimit: number,

  accountId: number | null,
  expiryTimestamp: number | null,
  recoveryCode: string | null,
  recoveryEmail: string | null,
};

export const recoveryState: RecoveryState = {
  inPasswordUpdateStage: false,

  recoveryEmailsSent: 0,
  recoveryEmailsSentLimit: EMAILS_SENT_LIMIT,

  accountId: null,
  expiryTimestamp: null,
  recoveryCode: null,
  recoveryEmail: null,
};