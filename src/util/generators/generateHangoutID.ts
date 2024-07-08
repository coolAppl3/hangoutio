const allowedCharacters: string = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijklmnpqrstuvwxyz0123456789'; // letters O/o not included
const tokenLength: number = allowedCharacters.length;

export default function generateHangoutID(): string {
  let hangoutID: string = 'h';

  while (hangoutID.length < 32) {
    hangoutID += allowedCharacters[Math.floor(Math.random() * tokenLength)];
  };

  return hangoutID;
};