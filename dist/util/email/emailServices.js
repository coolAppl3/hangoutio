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
exports.sendEmailUpdateWarningEmail = exports.sendEmailUpdateEmail = exports.sendDeletionWarningEmail = exports.sendDeletionConfirmationEmail = exports.sendRecoveryEmail = exports.sendVerificationEmail = void 0;
const emailTemplates = __importStar(require("./emailTemplates"));
const initTransporter_1 = require("./initTransporter");
;
async function sendVerificationEmail(verificationEmailConfig) {
    try {
        await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to: verificationEmailConfig.to,
            subject: 'Hangoutio - Account Verification',
            html: emailTemplates.getVerificationEmailTemplate(verificationEmailConfig),
        });
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
        await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to: recoveryEmailConfig.to,
            subject: 'Hangoutio - Account Recovery',
            html: emailTemplates.getRecoveryEmailTemplate(recoveryEmailConfig),
        });
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.sendRecoveryEmail = sendRecoveryEmail;
;
;
async function sendDeletionConfirmationEmail(deletionEmailConfig) {
    try {
        await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to: deletionEmailConfig.to,
            subject: 'Hangoutio - Account Deletion Confirmation',
            html: emailTemplates.getAccountDeletionConfirmationTemplate(deletionEmailConfig),
        });
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.sendDeletionConfirmationEmail = sendDeletionConfirmationEmail;
;
;
async function sendDeletionWarningEmail(deletionEmailWarningConfig) {
    try {
        await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to: deletionEmailWarningConfig.to,
            subject: 'Hangoutio - Security Warning',
            html: emailTemplates.getAccountDeletionWarningTemplate(deletionEmailWarningConfig.displayName),
        });
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.sendDeletionWarningEmail = sendDeletionWarningEmail;
;
;
async function sendEmailUpdateEmail(updateEmailConfig) {
    try {
        await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to: updateEmailConfig.to,
            subject: 'Hangoutio - Email Update',
            html: emailTemplates.getEmailUpdateTemplate(updateEmailConfig),
        });
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
        await initTransporter_1.emailTransporter.sendMail({
            from: `Hangoutio <${process.env.TRANSPORTER_USER}>`,
            to,
            subject: 'Hangoutio - Suspicious Activity',
            html: emailTemplates.getEmailUpdateWarningTemplate(displayName),
        });
    }
    catch (err) {
        console.log(err);
    }
    ;
}
exports.sendEmailUpdateWarningEmail = sendEmailUpdateWarningEmail;
;
