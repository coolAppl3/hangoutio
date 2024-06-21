import bcrypt from 'bcrypt';
const saltRounds: number = 10;

export async function hashPassword(plainPassword: string): Promise<string> {
  try {
    const hashedPassword: string = await bcrypt.hash(plainPassword, saltRounds);
    return hashedPassword;

  } catch (err: any) {
    console.log(err);
    return '';
  };
};