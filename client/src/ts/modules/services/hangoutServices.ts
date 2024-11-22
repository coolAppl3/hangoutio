import axios, { AxiosResponse } from "../../../../node_modules/axios/index";
import { HangoutChat, HangoutEvent, HangoutMember, HangoutMemberCountables, HangoutsDetails } from "../hangout/hangoutDataTypes";

const hangoutsApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/hangouts`
  : `https://${window.location.hostname}/api/hangouts`;
//


export interface CreateHangoutAsAccountBody {
  hangoutTitle: string,
  hangoutPassword: string | null,
  memberLimit: number,
  availabilityStep: number,
  suggestionsStep: number,
  votingStep: number,
};

export interface CreateHangoutAsAccountData {
  success: true,
  resData: {
    hangoutId: string,
  },
};

export async function createHangoutAsAccountService(authToken: string, requestBody: CreateHangoutAsAccountBody): Promise<AxiosResponse<CreateHangoutAsAccountData>> {
  return axios.post(`${hangoutsApiUrl}/create/accountLeader`, requestBody, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
};

// --- --- ---

export interface CreateHangoutAsGuestBody {
  hangoutTitle: string,
  hangoutPassword: string | null,
  memberLimit: number,
  availabilityStep: number,
  suggestionsStep: number,
  votingStep: number,
  username: string,
  password: string,
  displayName: string,
};

export interface CreateHangoutAsGuestData {
  success: true,
  resData: {
    hangoutId: string,
    authToken: string,
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

export interface JoinHangoutAsAccountBody {
  hangoutId: string,
  hangoutPassword: string | null,
};

export async function joinHangoutAsAccountService(authToken: string, requestBody: JoinHangoutAsAccountBody): Promise<AxiosResponse> {
  return axios.post(`${hangoutsApiUrl}/details/members/join/account`, requestBody, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
};

// --- --- ---

export interface JoinHangoutAsGuestBody {
  hangoutId: string,
  hangoutPassword: string | null,
  username: string,
  password: string,
  displayName: string,
};

export interface JoinHangoutAsGuestData {
  success: true,
  resData: {
    authToken: string,
  },
};

export async function joinHangoutAsGuestService(requestBody: JoinHangoutAsGuestBody): Promise<AxiosResponse<JoinHangoutAsGuestData>> {
  return axios.post(`${hangoutsApiUrl}/details/members/join/guest`, requestBody);
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

export async function getHangoutDashboardDataService(authToken: string, hangoutId: string): Promise<AxiosResponse<HangoutDashboardData>> {
  return axios.get(`${hangoutsApiUrl}/details/dashboard?hangoutId=${hangoutId}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
};