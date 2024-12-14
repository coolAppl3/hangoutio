import axios, { AxiosResponse } from "../../../../node_modules/axios/index";

axios.defaults.withCredentials = true;

const accountsApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/accounts`
  : `https://${window.location.hostname}/api/accounts`;
// 

export interface AccountSignUpBody {
  email: string,
  displayName: string,
  username: string,
  password: string,
};

export interface AccountSignUpData {
  success: true,
  resData: {
    accountId: number,
    verificationExpiryTimestamp: number,
  },
};

export async function accountSignUpService(requestBody: AccountSignUpBody): Promise<AxiosResponse<AccountSignUpData>> {
  return axios.post(`${accountsApiUrl}/signUp`, requestBody);
};

// --- --- ---

export interface AccountSignInBody {
  email: string,
  password: string,
  keepSignedIn: boolean,
};

export async function accountSignInService(requestBody: AccountSignInBody): Promise<AxiosResponse> {
  return axios.post(`${accountsApiUrl}/signIn`, requestBody);
};

// --- --- ---

export interface ResendVerificationEmailData {
  success: true,
  resData: {
    verificationEmailsSent: number,
  },
};

export async function resendVerificationEmailService(requestBody: { accountId: number }): Promise<AxiosResponse<ResendVerificationEmailData>> {
  return axios.post(`${accountsApiUrl}/verification/resendEmail`, requestBody);
};

// --- --- ---

export interface AccountVerificationBody {
  accountId: number,
  verificationCode: string,
};

export interface AccountVerificationData {
  success: true,
  resData: {
    authSessionCreated: boolean,
  };
};

export async function verifyAccountService(requestBody: AccountVerificationBody): Promise<AxiosResponse<AccountVerificationData>> {
  return axios.patch(`${accountsApiUrl}/verification/verify`, requestBody);
};

// --- --- ---

export interface StartAccountRecoveryData {
  success: true,
  resData: {
    accountId: number,
    expiryTimestamp: number,
  },
};

export async function startAccountRecoveryService(requestBody: { email: string }): Promise<AxiosResponse<StartAccountRecoveryData>> {
  return axios.post(`${accountsApiUrl}/recovery/start`, requestBody);
};

// --- --- ---

export async function resendAccountRecoveryEmailService(requestBody: { accountId: number }): Promise<AxiosResponse> {
  return axios.post(`${accountsApiUrl}/recovery/resendEmail`, requestBody);
};

// --- --- ---

export interface RecoveryUpdatePasswordBody {
  accountId: number,
  recoveryCode: string,
  newPassword: string,
};

export interface RecoveryUpdatePasswordData {
  success: true,
  resData: {
    authSessionCreated: boolean,
  },
};

export function recoveryUpdatePasswordService(requestBody: RecoveryUpdatePasswordBody): Promise<AxiosResponse<RecoveryUpdatePasswordData>> {
  return axios.patch(`${accountsApiUrl}/recovery/updatePassword`, requestBody);
};