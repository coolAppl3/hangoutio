import axios, { AxiosResponse } from "../../../../node_modules/axios/index";

const accountsApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/accounts`
  : `https://${window.location.hostname}/api/accounts`;
// 


export interface AccountSignInBody {
  email: string,
  password: string,
};

export interface AccountSignInData extends AxiosResponse {
  data: {
    success: true,
    resData: {
      authToken: string,
    },
  },
};

export async function accountSignInService(requestBody: AccountSignInBody): Promise<AccountSignInData> {
  return axios.post(`${accountsApiUrl}/signIn`, requestBody);
};

// --- --- ---

export interface AccountSignUpBody {
  email: string,
  displayName: string,
  username: string,
  password: string,
};

export interface AccountSignUpData extends AxiosResponse {
  data: {
    success: true,
    resData: {
      accountID: number,
      createdOnTimestamp: number,
    },
  },
};

export async function accountSignUpService(requestBody: AccountSignUpBody): Promise<AccountSignUpData> {
  return axios.post(`${accountsApiUrl}/signUp`, requestBody);
};

// --- --- ---

interface ResendVerificationEmailData extends AxiosResponse {
  data: {
    success: true,
    resData: {},
  },
};

export async function resendVerificationEmailService(requestBody: { accountID: number }): Promise<ResendVerificationEmailData> {
  return axios.post(`${accountsApiUrl}/verification/resendEmail`, requestBody);
};

// --- --- ---

export interface AccountVerificationBody {
  accountID: number,
  verificationCode: string,
};

export interface AccountVerificationData extends AxiosResponse {
  data: {
    success: true,
    resData: {
      authToken: string,
    },
  },
};

export async function verifyAccountService(requestBody: AccountVerificationBody): Promise<AccountVerificationData> {
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