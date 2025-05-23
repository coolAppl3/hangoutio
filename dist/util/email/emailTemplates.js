"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailUpdateWarningTemplate = exports.getEmailUpdateTemplate = exports.getAccountDeletionWarningTemplate = exports.getAccountDeletionConfirmationTemplate = exports.getRecoveryEmailTemplate = exports.getVerificationEmailTemplate = void 0;
const constants_1 = require("../constants");
function getVerificationEmailTemplate(verificationEmailConfig) {
    const { accountId, verificationCode, displayName, expiryTimestamp } = verificationEmailConfig;
    const htmlTemplate = `
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
          font-family: 'Roboto', 'Arial';
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
          To complete your account setup, use the following verification code: <span class="font-bold">${verificationCode}</span>. Alternatively, you can
          click this
          <a
            target="_blank"
            href="https://hangoutio.com/sign-up?id=${accountId}&expiryTimestamp=${expiryTimestamp}&verificationCode=${verificationCode}"
            >verification link</a
          >.
        </p>
        <p>Your account will be automatically deleted if it's not verified within ${constants_1.ACCOUNT_VERIFICATION_WINDOW / constants_1.minuteMilliseconds} minutes of being created.</p>
        <p>If this request wasn't made by you, feel free to ignore it.</p>
        <p id="end-of-email">Warmest regards,</p>
        <p>Hangoutio</p>
      </div>
    </body>
  </html>`;
    return htmlTemplate;
}
exports.getVerificationEmailTemplate = getVerificationEmailTemplate;
;
function getRecoveryEmailTemplate(recoveryEmailConfig) {
    const { accountId, recoveryCode, expiryTimestamp, displayName } = recoveryEmailConfig;
    const htmlTemplate = `
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
          font-family: 'Roboto', 'Arial';
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
        <p>We've received a request to recover your Hangoutio account.</p>
        <p>
          To continue, use the following recovery code: <span class="font-bold">${recoveryCode}</span>. Alternatively, you can click this
          <a
            target="_blank"
            href="https://hangoutio.com/account-recovery?id=${accountId}&expiryTimestamp=${expiryTimestamp}&recoveryCode=${recoveryCode}"
            >recovery link</a
          >.
        </p>
        <p>This recovery request will expire in an hour.</p>
        <p>If this request wasn't made by you, ensure that your inbox is secure, then feel free to ignore this email.</p>
        <p id="end-of-email">Warmest regards,</p>
        <p>Hangoutio</p>
      </div>
    </body>
  </html>`;
    return htmlTemplate;
}
exports.getRecoveryEmailTemplate = getRecoveryEmailTemplate;
;
function getAccountDeletionConfirmationTemplate(deletionEmailConfig) {
    const { confirmationCode, displayName } = deletionEmailConfig;
    const htmlTemplate = `
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
          font-family: 'Roboto', 'Arial';
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
        <p>We've received a request to delete your Hangoutio account.</p>
        <p>To continue, please use the following confirmation code: <span class="font-bold">${confirmationCode}</span>.</p>
        <p>This request will expire in an hour.</p>
        <p>If this request wasn't made by you, please sign into your account to abort the request and change your password as soon as possible to ensure it's protected.</p>
        <p>We're sad to see you leave, but wish you all the best moving forward!</p>
        <p id="end-of-email">Warmest regards,</p>
        <p>Hangoutio</p>
      </div>
    </body>
  </html>`;
    return htmlTemplate;
}
exports.getAccountDeletionConfirmationTemplate = getAccountDeletionConfirmationTemplate;
;
function getAccountDeletionWarningTemplate(displayName) {
    const htmlTemplate = `
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
            font-family: 'Roboto', 'Arial';
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
          <p>
            We've detected 3 failed attempts to delete your account, and have suspended further attempts for ${constants_1.ACCOUNT_DELETION_SUSPENSION_WINDOW / constants_1.hourMilliseconds} hours to protect your account.
          </p>
          <p>If these attempts weren't made by you, we highly suggest changing your account's password to ensure it's secure.</p>
          <p id="end-of-email">Warmest regards,</p>
          <p>Hangoutio</p>
        </div>
      </body>
    </html>`;
    return htmlTemplate;
}
exports.getAccountDeletionWarningTemplate = getAccountDeletionWarningTemplate;
;
function getEmailUpdateTemplate(updateEmailConfig) {
    const { confirmationCode, displayName } = updateEmailConfig;
    const htmlTemplate = `
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
          font-family: 'Roboto', 'Arial';
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
        <p>We've received a request to change the registered email address for your Hangoutio account to this one.</p>
        <p>To continue, please use the following confirmation code: <span class="font-bold">${confirmationCode}</span>.</p>
        <p>If this request wasn't made by you, feel free to ignore it.</p>
        <p id="end-of-email">Warmest regards,</p>
        <p>Hangoutio</p>
      </div>
    </body>
  </html>`;
    return htmlTemplate;
}
exports.getEmailUpdateTemplate = getEmailUpdateTemplate;
;
function getEmailUpdateWarningTemplate(displayName) {
    const htmlTemplate = `
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
          font-family: 'Roboto', 'Arial';
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
        <p>We've detected 3 failed attempts to change the registered email address for your Hangoutio account, and have suspended further attempts for ${constants_1.ACCOUNT_EMAIL_UPDATE_WINDOW / constants_1.hourMilliseconds} hours to protect your account.</p>
        <p>If these attempts weren't made by you, we highly suggest changing your account's password to ensure it's secure.</p>
        <p id="end-of-email">Warmest regards,</p>
        <p>Hangoutio</p>
      </div>
    </body>
  </html>`;
    return htmlTemplate;
}
exports.getEmailUpdateWarningTemplate = getEmailUpdateWarningTemplate;
;
