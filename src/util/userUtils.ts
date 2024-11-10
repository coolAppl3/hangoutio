export function getUserId(authToken: string): number {
  return +authToken.substring(33);
};

export function getUserType(authToken: string): 'account' | 'guest' {
  if (authToken.startsWith('a')) {
    return 'account';
  };

  return 'guest';
};

interface TimeTillNextRequest {
  hoursRemaining: number,
  minutesRemaining: number,
};

export function getTimeTillNextRequest(requestTimestamp: number, suspensionDuration: 'day' | 'hour'): TimeTillNextRequest {
  const minuteMilliseconds: number = 1000 * 60;
  const hourMilliseconds: number = 1000 * 60 * 60;
  const timeRequiredToPass: number = suspensionDuration === 'day' ? hourMilliseconds * 24 : hourMilliseconds;

  const differenceMilliseconds: number = Date.now() - requestTimestamp;
  const timeTillNextRequestMilliseconds: number = timeRequiredToPass - differenceMilliseconds;

  if (timeTillNextRequestMilliseconds < 0) {
    return { hoursRemaining: 0, minutesRemaining: 0 };
  };

  const hoursRemaining: number = Math.floor(timeTillNextRequestMilliseconds / hourMilliseconds);
  const minutesRemaining: number = Math.floor((timeTillNextRequestMilliseconds % hourMilliseconds) / minuteMilliseconds);

  return { hoursRemaining, minutesRemaining };
};