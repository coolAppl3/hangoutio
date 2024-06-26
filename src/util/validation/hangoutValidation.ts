export function isValidHangoutIDString(hangoutID: string): boolean {
  if (typeof hangoutID !== 'string') {
    return false;
  };

  if (hangoutID.length !== 32) {
    return false;
  };

  if (!hangoutID.startsWith('h')) {
    return false;
  };

  return true;
};


export function isValidHangoutConfiguration(availabilityPeriod: number, suggestionsPeriod: number, votingPeriod: number): boolean {
  if (availabilityPeriod < 1 || availabilityPeriod > 7) {
    return false;
  };

  if (suggestionsPeriod < 1 || suggestionsPeriod > 14) {
    return false;
  };

  if (votingPeriod < 1 || votingPeriod > 14) {
    return false;
  };

  if (
    !Number.isInteger(availabilityPeriod) ||
    !Number.isInteger(suggestionsPeriod) ||
    !Number.isInteger(votingPeriod)
  ) {
    return false;
  };

  return true;
};

const maxMemberLimit: number = 20;
export function isValidHangoutMemberLimit(limit: number): boolean {

  if (!Number.isInteger(limit)) {
    return false;
  };

  if (limit < 2 || limit > maxMemberLimit) {
    return false;
  };

  return true;
};