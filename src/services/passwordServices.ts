import { Response } from 'express';
import bcrypt from 'bcrypt';
const saltRounds: number = 10;

export async function getHashedPassword(res: Response, plainPassword: string): Promise<string> {
  try {
    const hashedPassword: string = await bcrypt.hash(plainPassword, saltRounds);
    return hashedPassword;

  } catch (err: any) {
    console.log(err);
    res.status(500).json({ success: false, message: 'Internal server error.' });

    return '';
  };
};