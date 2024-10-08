export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') {
    return false;
  };

  const regex: RegExp = /^(?=.{6,254}$)[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]{0,64}@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}?(?:\.[a-zA-Z]{2,})*$/;
  return regex.test(email);
};


export function isValidNewPassword(password: string): boolean {
  if (typeof password !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9._]{8,40}$/;
  return regex.test(password);
};

export function isValidPassword(password: string): boolean {
  if (typeof password !== 'string' || password.trim() === '') {
    return false;
  };

  return true;
};

export function isValidUsername(username: string): boolean {
  if (typeof username !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9_.]{5,25}$/;
  return regex.test(username);
};

export function isValidDisplayName(displayName: string): boolean {
  if (typeof displayName !== 'string') {
    return false;
  };

  if (displayName.trim() !== displayName) {
    return false;
  };

  const doubleSpacesRemoved: string = displayName.split(' ').filter((char: string) => char !== '').join(' ');
  if (displayName !== doubleSpacesRemoved) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z ]{1,25}$/;
  return regex.test(displayName);
};

export function isValidAuthToken(authToken: string): boolean {
  if (typeof authToken !== 'string') {
    return false;
  };

  if (authToken.length < 34) {
    return false;
  };

  if (!authToken.startsWith('a') && !authToken.startsWith('g')) {
    return false;
  };

  if (authToken[32] !== '_') {
    return false;
  };

  if (!Number.isInteger(+authToken.substring(33))) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9_]{34,}$/;
  return regex.test(authToken);
};

export function isValidUniqueToken(token: string): boolean {
  if (typeof token !== 'string') {
    return false;
  };

  if (token.length !== 32) {
    return false;
  };

  const regex: RegExp = /^[A-Za-z0-9]{32}$/;
  return regex.test(token);
};

export function isValidCode(verificationCode: string): boolean {
  if (typeof verificationCode !== 'string') {
    return false;
  };

  const regex: RegExp = /^[A-NP-Z0-9]{6}$/;
  return regex.test(verificationCode);
};