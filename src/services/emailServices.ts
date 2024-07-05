import { getVerificationEmailTemplate } from '../util/email/emailTemplates';
import { emailTransporter } from '../util/email/initTransporter';

export async function sendVerificationEmail(to: string, accountID: number, code: string): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: process.env.TRANSPORTER_USER,
      to,
      subject: 'Verify Your Hangoutio Account',
      html: getVerificationEmailTemplate(accountID, code),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};