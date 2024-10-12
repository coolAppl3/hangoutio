interface SignUpState {
  inVerificationStage: boolean,
  keepSignedIn: boolean,

  accountID: number | null,
  verificationStartTimestamp: number | null,
  verificationEmailsSent: number,
};

export const signUpState: SignUpState = {
  inVerificationStage: false,
  keepSignedIn: false,

  accountID: null,
  verificationStartTimestamp: null,
  verificationEmailsSent: 0,
};