export function isValidAuthSessionId(authSessionId: string): boolean {
  if (authSessionId.length !== 32) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9]{32}$/;
  return regex.test(authSessionId);
};

interface AuthSessionDetails {
  user_id: number,
  user_type: 'account' | 'guest',
  expiry_timestamp: number,
};

type ExpectedUserType = ('account' | 'guest') | null;

export function isValidAuthSessionDetails(authSessionDetails: AuthSessionDetails, expectedUserType: ExpectedUserType = null): boolean {
  if (expectedUserType && authSessionDetails.user_type !== expectedUserType) {
    return false;
  };

  if (authSessionDetails.expiry_timestamp <= Date.now()) {
    return false;
  };

  return true;
};