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
  recoveryEmailsSentLimit: 3,

  accountId: null,
  expiryTimestamp: null,
  recoveryCode: null,
  recoveryEmail: null,
};