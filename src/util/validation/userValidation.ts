export function isValidEmailString(email: string): boolean {
  if (typeof email !== 'string') {
    return false;
  };

  const regex: RegExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
  return regex.test(email);
};

export function isValidNameString(name: string): boolean {
  if (typeof name !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-Za-z ]{1,25}$/;
  return regex.test(name);
};

export function isValidPasswordString(password: string): boolean {
  if (typeof password !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9._]{8,40}$/;
  return regex.test(password);
};

export function isValidVerificationCodeString(verificationCode: string): boolean {
  if (typeof verificationCode !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-NP-Z0-9]{6}$/;
  return regex.test(verificationCode);
};

export function isValidAuthTokenString(authToken: string): boolean {
  if (typeof authToken !== 'string') {
    return false;
  };

  if (authToken.length !== 32) {
    return false;
  };

  if (!authToken.startsWith('a') && !authToken.startsWith('g')) {
    return false;
  };

  return true;
};

export function isValidRecoveryTokenString(recoveryToken: string): boolean {
  if (typeof recoveryToken !== 'string') {
    return false;
  };

  if (recoveryToken.length !== 32) {
    return false;
  };

  if (!recoveryToken.startsWith('r')) {
    return false;
  };

  return true;
};