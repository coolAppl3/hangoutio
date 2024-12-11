interface SignUpState {
  inVerificationStage: boolean,
  keepSignedIn: boolean,

  accountId: number | null,
  verificationExpiryTimestamp: number | null,
  verificationEmailsSent: number,
};

export const signUpState: SignUpState = {
  inVerificationStage: false,
  keepSignedIn: false,

  accountId: null,
  verificationExpiryTimestamp: null,
  verificationEmailsSent: 0,
};