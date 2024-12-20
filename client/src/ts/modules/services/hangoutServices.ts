import axios, { AxiosResponse } from "../../../../node_modules/axios/index";
import { HangoutChat, HangoutEvent, HangoutMember, HangoutMemberCountables, HangoutsDetails } from "../hangout/hangoutDataTypes";

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

export interface HangoutDashboardData {
  success: true,
  resData: {
    hangoutMemberId: number,
    isLeader: boolean,
    isPasswordProtected: boolean,
    decryptedPassword: string | null,

    hangoutDetails: HangoutsDetails,
    hangoutEvents: HangoutEvent[],
    hangoutMembers: HangoutMember[],
    hangoutMemberCountables: HangoutMemberCountables,
    hangoutChats: HangoutChat[],
  },
};

export async function getHangoutDashboardDataService(hangoutId: string): Promise<AxiosResponse<HangoutDashboardData>> {
  return axios.get(`${hangoutsApiUrl}/details/dashboard?hangoutId=${hangoutId}`);
};