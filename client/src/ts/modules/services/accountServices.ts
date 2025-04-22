import axios, { AxiosResponse } from "../../../../node_modules/axios/index";
import { AccountDetails, Hangout, Friend, FriendRequest } from "../account/accountTypes";

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

interface AccountSignUpData {
  accountId: number,
  verificationExpiryTimestamp: number,
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

interface ResendVerificationEmailData {
  verificationEmailsSent: number,
};

export async function resendVerificationEmailService(requestBody: { accountId: number }): Promise<AxiosResponse<ResendVerificationEmailData>> {
  return axios.post(`${accountsApiUrl}/verification/resendEmail`, requestBody);
};

// --- --- ---

export interface AccountVerificationBody {
  accountId: number,
  verificationCode: string,
};

interface AccountVerificationData {
  authSessionCreated: boolean,
};

export async function verifyAccountService(requestBody: AccountVerificationBody): Promise<AxiosResponse<AccountVerificationData>> {
  return axios.patch(`${accountsApiUrl}/verification/verify`, requestBody);
};

// --- --- ---

interface StartAccountRecoveryData {
  accountId: number,
  expiryTimestamp: number,
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

interface RecoveryUpdatePasswordData {
  authSessionCreated: boolean,
};

export function recoveryUpdatePasswordService(requestBody: RecoveryUpdatePasswordBody): Promise<AxiosResponse<RecoveryUpdatePasswordData>> {
  return axios.patch(`${accountsApiUrl}/recovery/updatePassword`, requestBody);
};

// --- --- ---

interface HangoutInfo {
  accountDetails: AccountDetails,
  friends: Friend[],
  friendRequests: FriendRequest[],
  hangoutHistory: Hangout[],

  hangoutsJoinedCount: number,
  ongoingHangoutsCount: number,
};

export function getAccountInfoService(): Promise<AxiosResponse<HangoutInfo>> {
  return axios.get(accountsApiUrl);
};