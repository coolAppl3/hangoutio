interface HangoutFormState {
  hangoutTitle: string | null,
  memberLimit: number,
  isPasswordProtected: boolean,
  hangoutPassword: string | null,
  availabilityStep: number,
  suggestionsStep: number,
  votingStep: number,
};

export const hangoutFormState: HangoutFormState = {
  hangoutTitle: null,
  memberLimit: 10,
  isPasswordProtected: false,
  hangoutPassword: null,
  availabilityStep: 1,
  suggestionsStep: 1,
  votingStep: 1,
};