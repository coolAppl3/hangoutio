const allowedCharacters: string = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789'; // letters O/o not included
const tokenLength: number = allowedCharacters.length;

export function generateAuthToken(userType: 'account' | 'guest'): string {
  let authToken: string = '';

  if (userType === 'account') {
    authToken = 'a';
  };

  if (userType === 'guest') {
    authToken = 'g';
  };

  while (authToken.length < 32) {
    authToken += allowedCharacters[Math.floor(Math.random() * tokenLength)];
  };

  return authToken;
};