"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailUpdateWarningEmail = exports.sendEmailUpdateEmail = exports.sendDeletionEmail = exports.sendRecoveryEmail = exports.sendVerificationEmail = void 0;
const emailTemplates = __importStar(require("./emailTemplates"));
const initTransporter_1 = require("./initTransporter");
;
async function sendVerificationEmail(verificationEmailConfig) {
    try {
        const info = await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to: verificationEmailConfig.to,
            subject: 'Hangoutio - Account Verification',
            html: emailTemplates.getVerificationEmailTemplate(verificationEmailConfig),
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
;
async function sendRecoveryEmail(recoveryEmailConfig) {
    try {
        const info = await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to: recoveryEmailConfig.to,
            subject: 'Hangoutio - Account Recovery',
            html: emailTemplates.getRecoveryEmailTemplate(recoveryEmailConfig),
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
;
async function sendDeletionEmail(deletionEmailConfig) {
    try {
        const info = await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to: deletionEmailConfig.to,
            subject: 'Hangoutio - Account Deletion',
            html: emailTemplates.getAccountDeletionTemplate(deletionEmailConfig),
        });
        console.log(`Email sent: ${info.response}`);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.sendDeletionEmail = sendDeletionEmail;
;
;
async function sendEmailUpdateEmail(updateEmailConfig) {
    try {
        const info = await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to: updateEmailConfig.to,
            subject: 'Hangoutio - Email Update',
            html: emailTemplates.getEmailUpdateTemplate(updateEmailConfig),
        });
        console.log(`Email sent: ${info.response}`);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.sendEmailUpdateEmail = sendEmailUpdateEmail;
;
async function sendEmailUpdateWarningEmail(to, displayName) {
    try {
        const info = await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to,
            subject: 'Hangoutio - Suspicious Activity',
            html: emailTemplates.getEmailUpdateWarningTemplate(displayName),
        });
        console.log(`Email sent: ${info.response}`);
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.sendEmailUpdateWarningEmail = sendEmailUpdateWarningEmail;
;
