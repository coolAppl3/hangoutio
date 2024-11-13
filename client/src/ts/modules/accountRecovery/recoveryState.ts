export enum RecoveryStage {
  emailForm = 'emailForm',
  confirmationForm = 'confirmationForm',
  updatePasswordForm = 'updatePasswordForm'
};

interface RecoveryState {
  currentStage: RecoveryStage,

  recoveryEmailsSent: number,
  recoveryEmailsSentLimit: number,

  recoveryAccountId: number | null,
  recoveryStartTimestamp: number | null,
  recoveryToken: string | null,
  recoveryEmail: string | null,
};

export const recoveryState: RecoveryState = {
  currentStage: RecoveryStage.emailForm,

  recoveryEmailsSent: 0,
  recoveryEmailsSentLimit: 3,

  recoveryAccountId: null,
  recoveryStartTimestamp: null,
  recoveryToken: null,
  recoveryEmail: null,
};