export enum RecoveryStage {
  emailForm = 'emailForm',
  confirmationForm = 'confirmationForm',
  updatePasswordForm = 'updatePasswordForm',
};

interface RecoveryState {
  currentStage: RecoveryStage,

  recoveryEmailsSent: number,
  recoveryEmailsSentLimit: number,

  recoveryAccountId: number | null,
  expiryTimestamp: number | null,
  recoveryToken: string | null,
  recoveryEmail: string | null,
};

export const recoveryState: RecoveryState = {
  currentStage: RecoveryStage.emailForm,

  recoveryEmailsSent: 0,
  recoveryEmailsSentLimit: 3,

  recoveryAccountId: null,
  expiryTimestamp: null,
  recoveryToken: null,
  recoveryEmail: null,
};