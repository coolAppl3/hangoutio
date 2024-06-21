const allowedCharacters: string = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789'; // letters O/o not included
const tokenLength: number = allowedCharacters.length;

export function generateAccountAuthToken(): string {
  let authToken: string = 'a';

  while (authToken.length < 32) {
    authToken += allowedCharacters[Math.floor(Math.random() * tokenLength)];
  };

  return authToken;
};

export function generateGuestAuthToken(): string {
  let authToken: string = 'g';

  while (authToken.length < 32) {
    authToken += allowedCharacters[Math.floor(Math.random() * tokenLength)];
  };

  return authToken;
};