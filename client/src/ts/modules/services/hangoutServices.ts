import axios, { AxiosResponse } from "../../../../node_modules/axios/index";
import { HangoutMessage, HangoutEvent, HangoutMember, HangoutMemberCountables, HangoutsDetails } from "../hangout/hangoutDataTypes";

axios.defaults.withCredentials = true;

const hangoutsApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/hangouts`
  : `https://${window.location.hostname}/api/hangouts`;
//

export interface CreateHangoutAsAccountBody {
  hangoutTitle: string,
  hangoutPassword: string | null,
  membersLimit: number,
  availabilityPeriod: number,
  suggestionsPeriod: number,
  votingPeriod: number,
};

export interface CreateHangoutAsAccountData {
  success: true,
  resData: {
    hangoutId: string,
  },
};

export async function createHangoutAsAccountService(requestBody: CreateHangoutAsAccountBody): Promise<AxiosResponse<CreateHangoutAsAccountData>> {
  return axios.post(`${hangoutsApiUrl}/create/accountLeader`, requestBody);
};

// --- --- ---

export interface CreateHangoutAsGuestBody {
  hangoutTitle: string,
  hangoutPassword: string | null,
  membersLimit: number,
  availabilityPeriod: number,
  suggestionsPeriod: number,
  votingPeriod: number,
  username: string,
  password: string,
  displayName: string,
};

export interface CreateHangoutAsGuestData {
  success: true,
  resData: {
    authSessionCreated: boolean,
    hangoutId: string,
  },
};

export async function createHangoutAsGuestService(requestBody: CreateHangoutAsGuestBody): Promise<AxiosResponse<CreateHangoutAsGuestData>> {
  return axios.post(`${hangoutsApiUrl}/create/guestLeader`, requestBody);
};

// --- --- ---

export interface HangoutExistsData {
  success: true,
  resData: {
    isPasswordProtected: boolean,
  },
};

export async function getHangoutExistsService(hangoutId: string): Promise<AxiosResponse<HangoutExistsData>> {
  return axios.get(`${hangoutsApiUrl}/details/hangoutExists?hangoutId=${hangoutId}`);
};

// --- --- ---

export interface InitialHangoutData {
  hangoutMemberId: number,
  isLeader: boolean,
  isPasswordProtected: boolean,
  decryptedHangoutPassword: string | null,

  hangoutDetails: HangoutsDetails,
  hangoutMembers: HangoutMember[],
  hangoutMemberCountables: HangoutMemberCountables,

  latestHangoutChats: HangoutMessage[],
  latestHangoutEvents: HangoutEvent[],
};

export interface InitialHangoutDataResponse {
  success: true,
  resData: InitialHangoutData,
};

export async function getInitialHangoutData(hangoutId: string): Promise<AxiosResponse<InitialHangoutDataResponse>> {
  return axios.get(`${hangoutsApiUrl}/details/initial?hangoutId=${hangoutId}`);
};