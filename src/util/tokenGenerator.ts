const allowedTokenCharacters: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const allowedCodeCharacters: string = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789'; // uppercase and lowercase O not included

export function generateAuthSessionId(): string {
  let sessionId: string = '';

  while (sessionId.length < 32) {
    sessionId += allowedTokenCharacters[Math.floor(Math.random() * allowedTokenCharacters.length)];
  };

  return sessionId;
};

export function generateRandomCode(): string {
  let verificationCode: string = '';

  while (verificationCode.length < 6) {
    verificationCode += allowedCodeCharacters[Math.floor(Math.random() * allowedCodeCharacters.length)];
  };

  return verificationCode;
};

export function generateRandomToken(): string {
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