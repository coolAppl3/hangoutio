const allowedCharacters: string = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789'; // letters O/o not included
const tokenLength: number = allowedCharacters.length;

export function generateCancellationToken(): string {
  let cancellationToken: string = 'c';

  while (cancellationToken.length < 32) {
    cancellationToken += allowedCharacters[Math.floor(Math.random() * tokenLength)];
  };

  return cancellationToken;
};