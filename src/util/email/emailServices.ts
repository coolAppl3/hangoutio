import * as emailTemplates from './emailTemplates';
import { emailTransporter } from './initTransporter';

export interface VerificationEmailConfig {
  to: string,
  accountId: number,
  verificationCode: string,
  displayName: string,
  expiryTimestamp: number,
};

export async function sendVerificationEmail(verificationEmailConfig: VerificationEmailConfig): Promise<void> {
  try {
    await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to: verificationEmailConfig.to,
      subject: 'Hangoutio - Account Verification',
      html: emailTemplates.getVerificationEmailTemplate(verificationEmailConfig),
    });

  } catch (err: unknown) {
    console.log(err);
  };
};

export interface RecoveryEmailConfig {
  to: string,
  accountId: number,
  recoveryCode: string,
  expiryTimestamp: number,
  displayName: string,
};

export async function sendRecoveryEmail(recoveryEmailConfig: RecoveryEmailConfig): Promise<void> {
  try {
    await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to: recoveryEmailConfig.to,
      subject: 'Hangoutio - Account Recovery',
      html: emailTemplates.getRecoveryEmailTemplate(recoveryEmailConfig),
    });

  } catch (err: unknown) {
    console.log(err);
  };
};

export interface DeletionEmailConfig {
  to: string,
  confirmationCode: string,
  displayName: string,
};

export async function sendDeletionConfirmationEmail(deletionEmailConfig: DeletionEmailConfig): Promise<void> {
  try {
    await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to: deletionEmailConfig.to,
      subject: 'Hangoutio - Account Deletion Confirmation',
      html: emailTemplates.getAccountDeletionConfirmationTemplate(deletionEmailConfig),
    });

  } catch (err: unknown) {
    console.log(err);
  };
};

export interface DeletionWarningConfig {
  to: string,
  displayName: string,
};

export async function sendDeletionWarningEmail(deletionEmailWarningConfig: DeletionWarningConfig): Promise<void> {
  try {
    await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to: deletionEmailWarningConfig.to,
      subject: 'Hangoutio - Security Warning',
      html: emailTemplates.getAccountDeletionWarningTemplate(deletionEmailWarningConfig.displayName),
    });

  } catch (err: unknown) {
    console.log(err);
  };
};

export interface UpdateEmailConfig {
  to: string,
  confirmationCode: string,
  displayName: string,
};

export async function sendEmailUpdateEmail(updateEmailConfig: UpdateEmailConfig): Promise<void> {
  try {
    await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to: updateEmailConfig.to,
      subject: 'Hangoutio - Email Update',
      html: emailTemplates.getEmailUpdateTemplate(updateEmailConfig),
    });

  } catch (err: unknown) {
    console.log(err);
  };
};

export async function sendEmailUpdateWarningEmail(to: string, displayName: string): Promise<void> {
  try {
    await emailTransporter.sendMail({
      from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
      to,
      subject: 'Hangoutio - Suspicious Activity',
      html: emailTemplates.getEmailUpdateWarningTemplate(displayName),
    });

  } catch (err: unknown) {
    console.log(err);
  };
};