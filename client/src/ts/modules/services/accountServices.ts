import axios, { AxiosResponse } from "../../../../node_modules/axios/index";

const accountsApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/accounts`
  : `https://${window.location.hostname}/api/accounts`;
// 


export interface AccountSignInBody {
  email: string,
  password: string,
};

export interface AccountSignInData {
  success: true,
  resData: {
    authToken: string,
  },
};

export async function accountSignInService(requestBody: AccountSignInBody): Promise<AxiosResponse<AccountSignInData>> {
  return axios.post(`${accountsApiUrl}/signIn`, requestBody);
};

// --- --- ---

export interface AccountSignUpBody {
  email: string,
  displayName: string,
  username: string,
  password: string,
};

export interface AccountSignUpData {
  success: true,
  resData: {
    accountID: number,
    createdOnTimestamp: number,
  },
};

export async function accountSignUpService(requestBody: AccountSignUpBody): Promise<AxiosResponse<AccountSignUpData>> {
  return axios.post(`${accountsApiUrl}/signUp`, requestBody);
};

// --- --- ---

export interface ResendVerificationEmailData {
  success: true,
  resData: {
    verificationEmailsSent: number,
  },
};

export async function resendVerificationEmailService(requestBody: { accountID: number }): Promise<AxiosResponse<ResendVerificationEmailData>> {
  return axios.post(`${accountsApiUrl}/verification/resendEmail`, requestBody);
};

// --- --- ---

export interface AccountVerificationBody {
  accountID: number,
  verificationCode: string,
};

export interface AccountVerificationData {
  success: true,
  resData: {
    authToken: string,
  },
};

export async function verifyAccountService(requestBody: AccountVerificationBody): Promise<AxiosResponse<AccountVerificationData>> {
  return axios.patch(`${accountsApiUrl}/verification/verify`, requestBody);
};

// --- --- ---

export interface SendRecoveryEmailData {
  success: true,
  resData: {
    requestTimestamp: number,
  },
};

export async function sendRecoveryEmailService(requestBody: { email: string }): Promise<AxiosResponse<SendRecoveryEmailData>> {
  return axios.post(`${accountsApiUrl}/recovery/sendEmail`, requestBody);
};

// --- --- ---

export interface RecoveryUpdatePasswordBody {
  accountID: number,
  recoveryToken: string,
  newPassword: string,
};

export interface RecoveryUpdatePasswordData {
  success: true,
  resData: {
    newAuthToken: string,
  },
};

export function recoveryUpdatePasswordService(requestBody: RecoveryUpdatePasswordBody): Promise<AxiosResponse<RecoveryUpdatePasswordData>> {
  return axios.patch(`${accountsApiUrl}/recovery/updatePassword`, requestBody);
};