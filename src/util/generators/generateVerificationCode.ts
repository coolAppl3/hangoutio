const allowedCharacters: string = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789'; // letters O/o not included
const codeLength: number = allowedCharacters.length;

export function generateVerificationCode(): string {
  let verificationCode: string = '';

  while (verificationCode.length < 6) {
    verificationCode += allowedCharacters[Math.floor(Math.random() * codeLength)];
  };

  return verificationCode;
};