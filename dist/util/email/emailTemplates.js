"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailUpdateWarningTemplate = exports.getEmailUpdateTemplate = exports.getAccountDeletionTemplate = exports.getRecoveryEmailTemplate = exports.getVerificationEmailTemplate = void 0;
function getVerificationEmailTemplate(accountID, verificationCode, displayName, createdOnTimestamp) {
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

          #verification-code {
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
            To complete your account creation, please enter the following verification code as instructed: <span id="verification-code">${verificationCode}</span>.
            Alternatively, you can click the following verification link:
            <a
              target="_blank"
              href="https://hangoutio.com/verification.html?id=${accountID}&timestamp=${createdOnTimestamp}&verificationCode=${verificationCode}"
              >https://hangoutio.com/verification.html?id=${accountID}&timestamp=${createdOnTimestamp}&verificationCode=${verificationCode}</a
            >.
          </p>
          <p>Your account will be automatically deleted if it's not verified within 15 minutes of being created.</p>
          <p>If this request wasn't made by you, feel free to ignore it.</p>
          <p id="end-of-email">Warmest regards,</p>
          <p>Hangoutio</p>
        </div>
      </body>
    </html>
  `;
    return htmlTemplate;
}
exports.getVerificationEmailTemplate = getVerificationEmailTemplate;
;
function getRecoveryEmailTemplate(accountID, recoveryToken, displayName) {
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

          #verification-code {
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
            To start the recovery process, please click the following link:
            <a
              target="_blank"
              href="https://hangoutio.com/recoverey.html?id=${accountID}&recoveryToken=${recoveryToken}"
              >https://hangoutio.com/recoverey.html?id=${accountID}&recoveryToken=${recoveryToken}</a
            >.
          </p>
          <p>If this request wasn't made by you, ensure that your inbox is secure, then feel free to ignore this email.</p>
          <p id="end-of-email">Warmest regards,</p>
          <p>Hangoutio</p>
        </div>
      </body>
    </html>
  `;
    return htmlTemplate;
}
exports.getRecoveryEmailTemplate = getRecoveryEmailTemplate;
;
function getAccountDeletionTemplate(accountID, cancellationToken, displayName) {
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

          #verification-code {
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
            Your account has been marked for deletion, and will be fully removed from our records after 48 hours. In the meantime, it won't be accessible and will behave as if it's fully deleted.
          </p>

          <p>
            If you've changed your mind, or have made this request by mistake, you can cancel it before the account is fully deleted by clicking the following link:
            <a
              target="_blank"
              href="https://hangoutio.com/cancelDeletion.html?id=${accountID}&recoveryToken=${cancellationToken}"
              >https://hangoutio.com/cancelDeletion.html?id=${accountID}&recoveryToken=${cancellationToken}</a
            >.
          </p>
          <p>If this request wasn't made by you, please click the link above and change your account's password as soon as possible.</p>
          <p>We're sad to see you leave, but wish you the best of luck moving forward!</p>
          <p id="end-of-email">Warmest regards,</p>
          <p>Hangoutio</p>
        </div>
      </body>
    </html>
  `;
    return htmlTemplate;
}
exports.getAccountDeletionTemplate = getAccountDeletionTemplate;
;
function getEmailUpdateTemplate(verificationCode, displayName) {
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

          #verification-code {
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
            To complete the process, please enter the following verification code as instructed: <span id="verification-code">${verificationCode}</span>.
            Alternatively, you can click the following link:
            <a
              target="_blank"
              href="https://hangoutio.com/updateEmail.html?verificationCode=${verificationCode}"
              >https://hangoutio.com/updateEmail.html?verificationCode=${verificationCode}</a
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

          #verification-code {
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
          <p>We noticed 3 failed attempts made for your Hangoutio account's registered email address.</p>
          <p>If this requests weren't made by you, please sign in and update your password to ensure your account is safe.</p>
          <p>Further email update attempts have been suspended for the next 24 hours to protect your account.</p>
          <p id="end-of-email">Warmest regards,</p>
          <p>Hangoutio</p>
        </div>
      </body>
    </html>
  `;
    return htmlTemplate;
}
exports.getEmailUpdateWarningTemplate = getEmailUpdateWarningTemplate;
;
