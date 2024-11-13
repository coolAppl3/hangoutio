interface SignUpState {
  inVerificationStage: boolean,
  keepSignedIn: boolean,

  accountId: number | null,
  verificationStartTimestamp: number | null,
  verificationEmailsSent: number,
};

export const signUpState: SignUpState = {
  inVerificationStage: false,
  keepSignedIn: false,

  accountId: null,
  verificationStartTimestamp: null,
  verificationEmailsSent: 0,
};