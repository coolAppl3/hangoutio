interface HangoutFormState {
  hangoutTitle: string | null,
  membersLimit: number,
  isPasswordProtected: boolean,
  hangoutPassword: string | null,
  availabilityPeriodDays: number,
  suggestionsPeriodDays: number,
  votingPeriodDays: number,
};

export const hangoutFormState: HangoutFormState = {
  hangoutTitle: null,
  membersLimit: 10,
  isPasswordProtected: false,
  hangoutPassword: null,
  availabilityPeriodDays: 1,
  suggestionsPeriodDays: 1,
  votingPeriodDays: 1,
};