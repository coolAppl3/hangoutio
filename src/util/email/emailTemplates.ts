import { ACCOUNT_EMAIL_UPDATE_WINDOW, ACCOUNT_VERIFICATION_WINDOW } from "../constants";
import { DeletionEmailConfig, RecoveryEmailConfig, UpdateEmailConfig, VerificationEmailConfig } from "./emailServices";

export function getVerificationEmailTemplate(verificationEmailConfig: VerificationEmailConfig): string {
  const { accountId, verificationCode, displayName, expiryTimestamp } = verificationEmailConfig;

  const htmlTemplate: string = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossorigin
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Roboto', sans-serif;
        }

        body {
          color: #222222;
          font-weight: 500 !important;
          font-size: 16px;
        }

        p {
          margin-bottom: 10px;
          line-height: 1.2;
        }

        a {
          text-decoration: none;
          color: #1155cc;
          text-decoration: underline;
          transition: filter 200ms;
        }

        a:hover {
          filter: brightness(0.8);
        }

        .email-body {
          padding: 30px 10px;
          max-height: fit-content;
        }

        .font-bold {
          font-weight: bold;
        }

        #end-of-email {
          margin-bottom: 0px;
        }
      </style>
    </head>
    <body>
      <div class="email-body">
        <p>Hey ${displayName},</p>
        <p>Welcome to Hangoutio!</p>
        <p>
          To complete your account creation, please enter the following verification code: <span class="font-bold">${verificationCode}</span>. Alternatively, you can
          click this
          <a
            target="_blank"
            href="https://hangoutio.com/sign-up?id=${accountId}&expiryTimestamp=${expiryTimestamp}&verificationCode=${verificationCode}"
            >verification link</a
          >.
        </p>
        <p>Your account will be automatically deleted if it's not verified within ${ACCOUNT_VERIFICATION_WINDOW} minutes of being created.</p>
        <p>If this request wasn't made by you, feel free to ignore it.</p>
        <p id="end-of-email">Warmest regards,</p>
        <p>Hangoutio</p>
      </div>
    </body>
  </html>
  `;

  return htmlTemplate;
};

export function getRecoveryEmailTemplate(recoveryEmailConfig: RecoveryEmailConfig): string {
  const { accountId, recoveryToken, expiryTimestamp, displayName } = recoveryEmailConfig;

  const htmlTemplate: string = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossorigin
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Roboto', sans-serif;
        }

        body {
          color: #222222;
          font-weight: 500 !important;
          font-size: 16px;
        }

        p {
          margin-bottom: 10px;
          line-height: 1.2;
        }

        a {
          text-decoration: none;
          color: #1155cc;
          text-decoration: underline;
          transition: filter 200ms;
        }

        a:hover {
          filter: brightness(0.8);
        }

        .email-body {
          padding: 30px 10px;
          max-height: fit-content;
        }

        .font-bold {
          font-weight: bold;
        }

        #end-of-email {
          margin-bottom: 0px;
        }
      </style>
    </head>
    <body>
      <div class="email-body">
        <p>Hey ${displayName},</p>
        <p>We've received a recovery request for your account.</p>
        <p>
          To start the proceed with the recovery process, please click
          <a
            target="_blank"
            href="https://hangoutio.com/account-recovery?id=${accountId}&expiryTimestamp=${expiryTimestamp}&recoveryToken=${recoveryToken}"
            >this link</a
          >. Please note that the recovery link is only valid for an hour.
        </p>
        <p>If this request wasn't made by you, ensure that your inbox is secure, then feel free to ignore this email.</p>
        <p id="end-of-email">Warmest regards,</p>
        <p>Hangoutio</p>
      </div>
    </body>
  </html>
  `;

  return htmlTemplate;
};

export function getAccountDeletionConfirmationTemplate(deletionEmailConfig: DeletionEmailConfig): string {
  const { confirmationCode, displayName } = deletionEmailConfig;

  const htmlTemplate: string = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossorigin
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Roboto', sans-serif;
        }

        body {
          color: #222222;
          font-weight: 500 !important;
          font-size: 16px;
        }

        p {
          margin-bottom: 10px;
          line-height: 1.2;
        }

        a {
          text-decoration: none;
          color: #1155cc;
          text-decoration: underline;
          transition: filter 200ms;
        }

        a:hover {
          filter: brightness(0.8);
        }

        .email-body {
          padding: 30px 10px;
          max-height: fit-content;
        }

        .font-bold {
          font-weight: bold;
        }

        #end-of-email {
          margin-bottom: 0px;
        }
      </style>
    </head>
    <body>
      <div class="email-body">
        <p>Hey ${displayName},</p>
        <p>We're reaching out to confirm your account deletion request.</p>
        <p>
          To confirm your wish to delete your account, please use the following code: <span class="font-bold">${confirmationCode}</span>. This request is only
          valid for the next hour.
        </p>
        <p>If this request wasn't made by you, please sign into your account and change your password as soon as possible to ensure it's protected.</p>
        <p>We're sad to see you leave, but wish you the best of luck moving forward!</p>
        <p id="end-of-email">Warmest regards,</p>
        <p>Hangoutio</p>
      </div>
    </body>
  </html>
  `;

  return htmlTemplate;
};

export function getAccountDeletionWarningTemplate(displayName: string): string {
  const htmlTemplate: string = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossorigin
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
          rel="stylesheet"
        />

        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Roboto', sans-serif;
          }

          body {
            color: #222222;
            font-weight: 500 !important;
            font-size: 16px;
          }

          p {
            margin-bottom: 10px;
            line-height: 1.2;
          }

          a {
            text-decoration: none;
            color: #1155cc;
            text-decoration: underline;
            transition: filter 200ms;
          }

          a:hover {
            filter: brightness(0.8);
          }

          .email-body {
            padding: 30px 10px;
            max-height: fit-content;
          }
          
          .font-bold {
            font-weight: bold;
          }

          #end-of-email {
            margin-bottom: 0px;
          }

        </style>
      </head>
      <body>
        <div class="email-body">
          <p>Hey ${displayName},</p>
          <p>We're reaching out to confirm your account deletion request.</p>
          <p>
            We've detected 3 failed attempts to delete your account, and have therefore suspended further attempts for the next 24 hours.
          </p>
          <p>If these requests were not made by you, we highly suggest changing your account's password to ensure it's secure.</p>
          <p id="end-of-email">Warmest regards,</p>
          <p>Hangoutio</p>
        </div>
      </body>
    </html>
  `;

  return htmlTemplate;
};

export function getEmailUpdateTemplate(updateEmailConfig: UpdateEmailConfig): string {
  const { verificationCode, displayName } = updateEmailConfig;

  const htmlTemplate: string = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossorigin
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Roboto', sans-serif;
        }

        body {
          color: #222222;
          font-weight: 500 !important;
          font-size: 16px;
        }

        p {
          margin-bottom: 10px;
          line-height: 1.2;
        }

        a {
          text-decoration: none;
          color: #1155cc;
          text-decoration: underline;
          transition: filter 200ms;
        }

        a:hover {
          filter: brightness(0.8);
        }

        .email-body {
          padding: 30px 10px;
          max-height: fit-content;
        }

        .font-bold {
          font-weight: bold;
        }

        #end-of-email {
          margin-bottom: 0px;
        }
      </style>
    </head>
    <body>
      <div class="email-body">
        <p>Hey ${displayName},</p>
        <p>We've received a request to change the registered email address for your Hangoutio account.</p>
        <p>
          To complete the process, please use the following verification code: <span class="font-bold">${verificationCode}</span>. Alternatively, you can click
          <a
            target="_blank"
            href="https://hangoutio.com/update-email?verificationCode=${verificationCode}"
            >this link</a
          >.
        </p>
        <p>If this request wasn't made by you, feel free to ignore it.</p>
        <p id="end-of-email">Warmest regards,</p>
        <p>Hangoutio</p>
      </div>
    </body>
</html>
  `;

  return htmlTemplate;
};

export function getEmailUpdateWarningTemplate(displayName: string): string {
  const htmlTemplate: string = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossorigin
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Roboto', sans-serif;
        }

        body {
          color: #222222;
          font-weight: 500 !important;
          font-size: 16px;
        }

        p {
          margin-bottom: 10px;
          line-height: 1.2;
        }

        a {
          text-decoration: none;
          color: #1155cc;
          text-decoration: underline;
          transition: filter 200ms;
        }

        a:hover {
          filter: brightness(0.8);
        }

        .email-body {
          padding: 30px 10px;
          max-height: fit-content;
        }

        .font-bold {
          font-weight: bold;
        }

        #end-of-email {
          margin-bottom: 0px;
        }
      </style>
    </head>
    <body>
      <div class="email-body">
        <p>Hey ${displayName},</p>
        <p>We've detected 3 failed attempts to update the email address linked to your Hangoutio account.</p>
        <p>If these requests weren't made by you, please sign in and update your password to ensure your account is safe.</p>
        <p>Further email update attempts have been suspended for the next ${ACCOUNT_EMAIL_UPDATE_WINDOW} hours to protect your account.</p>
        <p id="end-of-email">Warmest regards,</p>
        <p>Hangoutio</p>
      </div>
    </body>
  </html>
  `;

  return htmlTemplate;
};