import * as emailTemplates from './emailTemplates';
import { emailTransporter } from './initTransporter';

export interface VerificationEmailConfig {
  to: string,
  accountID: number,
  verificationCode: string,
  displayName: string,
  createdOnTimestamp: number,
};

export async function sendVerificationEmail(verificationEmailConfig: VerificationEmailConfig): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to: verificationEmailConfig.to,
      subject: 'Hangoutio - Account Verification',
      html: emailTemplates.getVerificationEmailTemplate(verificationEmailConfig),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};

export interface RecoveryEmailConfig {
  to: string,
  accountID: number,
  recoveryToken: string,
  requestTimestamp: number,
  displayName: string,
};

export async function sendRecoveryEmail(recoveryEmailConfig: RecoveryEmailConfig): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to: recoveryEmailConfig.to,
      subject: 'Hangoutio - Account Recovery',
      html: emailTemplates.getRecoveryEmailTemplate(recoveryEmailConfig),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};

export interface DeletionEmailConfig {
  to: string,
  accountID: number,
  cancellationToken: string,
  displayName: string,
};

export async function sendDeletionEmail(deletionEmailConfig: DeletionEmailConfig): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to: deletionEmailConfig.to,
      subject: 'Hangoutio - Account Deletion',
      html: emailTemplates.getAccountDeletionTemplate(deletionEmailConfig),
    });

    console.log(`Email sent: ${info.response}`);

  } catch (err: any) {
    console.log(err);
  };
};

export interface UpdateEmailConfig {
  to: string,
  verificationCode: string,
  displayName: string,
};

export async function sendEmailUpdateEmail(updateEmailConfig: UpdateEmailConfig): Promise<void> {
  try {
    const info: any = await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to: updateEmailConfig.to,
      subject: 'Hangoutio - Email Update',
      html: emailTemplates.getEmailUpdateTemplate(updateEmailConfig),
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