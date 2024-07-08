"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendRecoveryEmail = exports.sendVerificationEmail = void 0;
const emailTemplates_1 = require("../util/email/emailTemplates");
const initTransporter_1 = require("../util/email/initTransporter");
async function sendVerificationEmail(to, accountID, code) {
    try {
        const info = await initTransporter_1.emailTransporter.sendMail({
            from: process.env.TRANSPORTER_USER,
            to,
            subject: 'Verify Your Hangoutio Account',
            html: (0, emailTemplates_1.getVerificationEmailTemplate)(accountID, code),
        });
        console.log(`Email sent: ${info.response}`);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.sendVerificationEmail = sendVerificationEmail;
;
async function sendRecoveryEmail(to, recoveryToken) {
    try {
        const info = await initTransporter_1.emailTransporter.sendMail({
            from: process.env.TRANSPORTER_USER,
            to,
            subject: 'Hangoutio Account Recovery',
            html: (0, emailTemplates_1.getRecoveryEmailTemplate)(recoveryToken),
        });
        console.log(`Email sent: ${info.response}`);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.sendRecoveryEmail = sendRecoveryEmail;
;
