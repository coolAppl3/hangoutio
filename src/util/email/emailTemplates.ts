export function getVerificationEmailTemplate(accountID: number, code: string): string {
  const htmlTemplate: string = `
<p
  style="
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 16px;
    font-weight: 500;
    line-height: 1;
    padding: 20px 0;
    margin: 0;
    background: transparent;
  "
>
  Hey there,
  <br /><br />
  We've received a request to create an account with your email address.
  <br /><br />
  To verify your email, please enter the following verification code: <span style="font-weight: bold">${code}</span>. Alternatively, you can click the
  following link:
  <a
    href="https://hangoutio.com/verification.html?id=${accountID}&verificationCode=${code}"
    target="_blank"
    style="text-decoration: none; color: #1155cc; font-weight: 500; text-decoration: underline"
    >verification link</a
  >. <br /><br />
  If this request wasn't made by you, feel free to ignore this email.
  <br /><br />
  Warmest regards,
  <br />
  Hangoutio
</p>
`;

  return htmlTemplate;
};

export function getRecoveryEmailTemplate(recoveryToken: string): string {
  const htmlTemplate: string = `
<p
  style="
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 16px;
    font-weight: 500;
    line-height: 1;
    padding: 20px 0;
    margin: 0;
    background: transparent;
  "
>
  Hey there,
  <br /><br />
  We've received a recovery request for your account.
  <br /><br />
  To recover your account, please click the following link:
  <a
    href="https://hangoutio.com/recovery.html?recoveryToken=${recoveryToken}"
    target="_blank"
    style="text-decoration: none; color: #1155cc; font-weight: 500; text-decoration: underline"
    >recovery link</a
  >. <br /><br />
  If this request wasn't made by you, ensure that your inbox is secure, then feel free to ignore this email.
  <br /><br />
  Warmest regards,
  <br />
  Hangoutio
</p>
`;

  return htmlTemplate;
};