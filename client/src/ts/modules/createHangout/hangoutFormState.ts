type TimeSlot = { from: string, to: string };

interface HangoutFormState {
  leaderName: string;
  leaderPassword: string;

  availabilityPeriod: number,
  suggestionsPeriod: number,
  votingPeriod: number,

  dateTimestamp: number,
  dateText: string,

  timeSlots: TimeSlot[],
};

export const hangoutFormState: HangoutFormState = {
  leaderName: '',
  leaderPassword: '',

  availabilityPeriod: 1,
  suggestionsPeriod: 1,
  votingPeriod: 1,

  dateTimestamp: 0,
  dateText: '',

  timeSlots: [],
};
