const allowedCharacters: string = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789'; // letters O/o not included
const tokenLength: number = allowedCharacters.length;

export function generateRecoveryToken(): string {
  let recoveryToken: string = 'r';

  while (recoveryToken.length < 32) {
    recoveryToken += allowedCharacters[Math.floor(Math.random() * tokenLength)];
  };

  return recoveryToken;
};