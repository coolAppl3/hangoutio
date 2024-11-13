import crypto, { Cipher, Decipher } from 'crypto';

export function encryptPassword(password: string): string | null {
  const encryptionKeyHex: string | undefined = process.env.ENCRYPTION_KEY;
  if (!encryptionKeyHex) {
    return null;
  };

  const encryptionKeyBuffer: Buffer = Buffer.from(encryptionKeyHex, 'hex');
  const iv: Buffer = crypto.randomBytes(16);

  const cipher: Cipher = crypto.createCipheriv('aes-256-cbc', encryptionKeyBuffer, iv);
  let encryptedPassword: string = cipher.update(password, 'utf8', 'hex');
  encryptedPassword += cipher.final('hex');

  const storableEncryptedPassword: string = `${iv.toString('hex')}-${encryptedPassword}`;
  return storableEncryptedPassword;
};

export function decryptPassword(storedEncryptedPassword: string): string | null {
  const encryptionKeyHex: string | undefined = process.env.ENCRYPTION_KEY;
  if (!encryptionKeyHex) {
    return null;
  };

  const [storedIvHex, encryptedPassword] = storedEncryptedPassword.split('-');
  if (!storedIvHex || !encryptedPassword) {
    return null;
  };

  const ivBuffer: Buffer = Buffer.from(storedIvHex, 'hex');
  const encryptionKeyBuffer: Buffer = Buffer.from(encryptionKeyHex, 'hex');

  const decipher: Decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKeyBuffer, ivBuffer);
  let decryptedPassword: string = decipher.update(encryptedPassword, 'hex', 'utf8');
  decryptedPassword += decipher.final('utf8');

  return decryptedPassword;
};