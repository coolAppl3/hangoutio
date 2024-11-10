const allowedTokenCharacters: string = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789'; // letters O/o not included
const allowedCodeCharacters: string = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789'; // letters O/o not included

export function generateAuthToken(userType: 'account' | 'guest'): string {

  let authToken: string = '';

  if (userType === 'account') {
    authToken = 'a';
  };

  if (userType === 'guest') {
    authToken = 'g';
  };

  while (authToken.length < 32) {
    authToken += allowedTokenCharacters[Math.floor(Math.random() * allowedTokenCharacters.length)];
  };

  return authToken;
};

export function generateUniqueCode(): string {
  let verificationCode: string = '';

  while (verificationCode.length < 6) {
    verificationCode += allowedCodeCharacters[Math.floor(Math.random() * allowedCodeCharacters.length)];
  };

  return verificationCode;
};

export function generateUniqueToken(): string {
  let token: string = '';

  while (token.length < 32) {
    token += allowedTokenCharacters[Math.floor(Math.random() * allowedTokenCharacters.length)];
  };

  return token;
};

// non-account related
export function generateHangoutId(timestamp: number): string {
  let hangoutId: string = 'h';

  while (hangoutId.length < 32) {
    hangoutId += allowedTokenCharacters[Math.floor(Math.random() * allowedTokenCharacters.length)];
  };

  return `${hangoutId}_${timestamp}`;
};