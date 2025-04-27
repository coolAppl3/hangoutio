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

export interface AccountSignInBody {
  email: string,
  password: string,
  keepSignedIn: boolean,
};

export async function accountSignInService(requestBody: AccountSignInBody): Promise<AxiosResponse> {
  return axios.post(`${accountsApiUrl}/signIn`, requestBody);
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

interface UpdateDisplayNameBody {
  password: string,
  newDisplayName: string,
};

export function updateDisplayNameService(requestBody: UpdateDisplayNameBody): Promise<AxiosResponse> {
  return axios.patch(`${accountsApiUrl}/details/updateDisplayName`, requestBody);
};

// --- --- ---

interface UpdatePasswordBody {
  currentPassword: string,
  newPassword: string,
};

interface UpdatePasswordData {
  authSessionCreated: boolean,
};

export function updatePasswordService(requestBody: UpdatePasswordBody): Promise<AxiosResponse<UpdatePasswordData>> {
  return axios.patch(`${accountsApiUrl}/details/updatePassword`, requestBody);
};

// --- --- ---

interface StartEmailUpdateBody {
  password: string,
  newEmail: string,
};

export function startEmailUpdateService(requestBody: StartEmailUpdateBody): Promise<AxiosResponse> {
  return axios.post(`${accountsApiUrl}/details/updateEmail/start`, requestBody);
};

// --- --- ---

export function resendEmailUpdateEmailService(): Promise<AxiosResponse> {
  return axios.get(`${accountsApiUrl}/details/updateEmail/resendEmail`);
};

// --- --- ---

interface ConfirmEmailUpdateBody {
  confirmationCode: string,
};

interface ConfirmEmailUpdateData {
  authSessionCreated: boolean,
};

export function confirmEmailUpdateService(requestBody: ConfirmEmailUpdateBody): Promise<AxiosResponse<ConfirmEmailUpdateData>> {
  return axios.patch(`${accountsApiUrl}/details/updateEmail/confirm`, requestBody);
};

// --- --- ---

export function startAccountDeletionService(password: string): Promise<AxiosResponse> {
  return axios.delete(`${accountsApiUrl}/deletion/start?password=${password}`);
};

// --- --- ---

export function resendDeletionEmailService(): Promise<AxiosResponse> {
  return axios.get(`${accountsApiUrl}/deletion/resendEmail`);
};

// --- --- ---

export function confirmAccountDeletionService(confirmationCode: string): Promise<AxiosResponse> {
  return axios.delete(`${accountsApiUrl}/deletion/start?confirmationCode=${confirmationCode}`);
};

// --- --- ---

interface SendFriendRequestBody {
  requesteeUsername: string,
};

export function sendFriendRequestService(requestBody: SendFriendRequestBody): Promise<AxiosResponse> {
  return axios.post(`${accountsApiUrl}/friends/requests/send`, requestBody);
};

// --- --- ---

interface AcceptFriendRequestBody {
  friendRequestId: number,
};

export function acceptFriendRequestService(requestBody: AcceptFriendRequestBody): Promise<AxiosResponse> {
  return axios.post(`${accountsApiUrl}/friends/requests/accept`, requestBody);
};

// --- --- ---

export function rejectFriendRequestService(friendRequestId: number): Promise<AxiosResponse> {
  return axios.delete(`${accountsApiUrl}/friends/requests/reject?friendRequestId=${friendRequestId}`);
};

// --- --- ---

export function removeFriendService(friendshipId: number): Promise<AxiosResponse> {
  return axios.delete(`${accountsApiUrl}/friends/manager/remove?friendshipId=${friendshipId}`);
};

// --- --- ---

interface AccountInfo {
  accountDetails: AccountDetails,
  friends: Friend[],
  friendRequests: FriendRequest[],
  hangoutHistory: Hangout[],

  hangoutsJoinedCount: number,
  ongoingHangoutsCount: number,
};

export function getAccountInfoService(): Promise<AxiosResponse<AccountInfo>> {
  return axios.get(accountsApiUrl);
};