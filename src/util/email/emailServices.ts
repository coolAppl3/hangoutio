import * as emailTemplates from './emailTemplates';
import { emailTransporter } from './initTransporter';

export async function sendVerificationEmail(to: string, accountID: number, code: string, displayName: string, createdOnTimestamp: number): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to,
      subject: 'Hangoutio - Account Verification',
      html: emailTemplates.getVerificationEmailTemplate(accountID, code, displayName, createdOnTimestamp),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};

export async function sendRecoveryEmail(to: string, accountID: number, recoveryToken: string, displayName: string): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to,
      subject: 'Hangoutio - Account Recovery',
      html: emailTemplates.getRecoveryEmailTemplate(accountID, recoveryToken, displayName),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};

export async function sendDeletionEmail(to: string, accountID: number, cancellationToken: string, displayName: string): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to,
      subject: 'Hangoutio - Account Deletion',
      html: emailTemplates.getAccountDeletionTemplate(accountID, cancellationToken, displayName),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};

export async function sendEmailUpdateEmail(to: string, verificationCode: string, displayName: string): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to,
      subject: 'Hangoutio - Email Update',
      html: emailTemplates.getEmailUpdateTemplate(verificationCode, displayName),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};

export async function sendEmailUpdateWarningEmail(to: string, displayName: string): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to,
      subject: 'Hangoutio - Suspicious Activity',
      html: emailTemplates.getEmailUpdateWarningTemplate(displayName),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};