import axios, { AxiosResponse } from "../../../../node_modules/axios/index";
import { HangoutChat, HangoutEvent, HangoutMember, HangoutMemberCountables, HangoutsDetails } from "../hangout/hangoutDataTypes";

const hangoutsApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/hangouts`
  : `https://${window.location.hostname}/api/hangouts`;
//


export interface AccountLeaderHangoutBody {
  hangoutTitle: string,
  hangoutPassword: string | null,
  memberLimit: number,
  availabilityStep: number,
  suggestionsStep: number,
  votingStep: number,
};

export interface AccountLeaderHangoutData {
  success: true,
  resData: {
    hangoutId: string,
    hangoutMemberId: number,
  },
};

export async function createAccountLeaderHangoutService(authToken: string, requestBody: AccountLeaderHangoutBody): Promise<AxiosResponse<AccountLeaderHangoutData>> {
  return axios.post(`${hangoutsApiUrl}/create/accountLeader`, requestBody, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
};

// --- --- ---

export interface GuestLeaderHangoutBody {
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

export interface GuestLeaderHangoutData {
  success: true,
  resData: {
    hangoutId: string,
    authToken: string,
  },
};

export async function createGuestLeaderHangoutService(requestBody: GuestLeaderHangoutBody): Promise<AxiosResponse<GuestLeaderHangoutData>> {
  return axios.post(`${hangoutsApiUrl}/create/guestLeader`, requestBody);
};

// --- --- ---

export interface HangoutExistsData {
  success: true,
  resData: {
    isPasswordProtected: boolean,
    isFull: boolean,
  },
};

export async function getHangoutExistsService(hangoutId: string): Promise<AxiosResponse<HangoutExistsData>> {
  return axios.get(`${hangoutsApiUrl}/details/hangoutExists?hangoutId=${hangoutId}`);
};

// --- --- ---

interface AccountJoinHangoutBody {
  hangoutId: string,
  hangoutPassword: string | null,
};

export async function accountJoinHangoutService(authToken: string, requestBody: AccountJoinHangoutBody): Promise<AxiosResponse> {
  return axios.post(`${hangoutsApiUrl}/details/members/join/account`, requestBody, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
};

// --- --- ---

interface GuestJoinHangoutBody {
  hangoutId: string,
  hangoutPassword: string | null,
  username: string,
  password: string,
  displayName: string,
};

interface GuestJoinHangoutData {
  authToken: string,
};

export async function guestJoinHangoutService(requestBody: GuestJoinHangoutBody): Promise<AxiosResponse<GuestJoinHangoutData>> {
  return axios.post(`${hangoutsApiUrl}/details/members/join/guest`, requestBody);
};

// --- --- ---

export interface HangoutDashboardData {
  success: true,
  resData: {
    hangoutMemberId: number,
    isLeader: boolean,
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