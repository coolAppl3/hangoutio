import * as emailTemplates from '../util/email/emailTemplates';
import { emailTransporter } from '../util/email/initTransporter';

export async function sendVerificationEmail(to: string, accountID: number, code: string): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to,
      subject: 'Hangoutio - Account Verification',
      html: emailTemplates.getVerificationEmailTemplate(accountID, code),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};

export async function sendRecoveryEmail(to: string, accountID: number, recoveryToken: string): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to,
      subject: 'Hangoutio - Account Recovery',
      html: emailTemplates.getRecoveryEmailTemplate(accountID, recoveryToken),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};

export async function sendDeletionEmail(to: string, accountID: number, cancellationToken: string): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to,
      subject: 'Hangoutio - Account Deletion',
      html: emailTemplates.getAccountDeletionTemplate(accountID, cancellationToken),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};

export async function sendEmailUpdateEmail(to: string, accountID: number, verificationCode: string): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to,
      subject: 'Hangoutio - Email Update',
      html: emailTemplates.getEmailUpdateTemplate(accountID, verificationCode),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};