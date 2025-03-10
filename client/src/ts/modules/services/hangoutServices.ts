import axios, { AxiosResponse } from "../../../../node_modules/axios/index";
import { ChatMessage, HangoutEvent, HangoutMember, HangoutMemberCountables, HangoutsDetails } from "../hangout/hangoutTypes";

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

interface CreateHangoutAsAccountData {
  hangoutId: string,
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

interface CreateHangoutAsGuestData {
  authSessionCreated: boolean,
  hangoutId: string,
};

export async function createHangoutAsGuestService(requestBody: CreateHangoutAsGuestBody): Promise<AxiosResponse<CreateHangoutAsGuestData>> {
  return axios.post(`${hangoutsApiUrl}/create/guestLeader`, requestBody);
};

// --- --- ---

interface HangoutExistsData {
  isPasswordProtected: boolean,
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

  conclusionTimestamp: number,

  hangoutDetails: HangoutsDetails,
  hangoutMembers: HangoutMember[],
  hangoutMemberCountables: HangoutMemberCountables,

  latestChatMessages: ChatMessage[],
  latestHangoutEvents: HangoutEvent[],
};

export async function getInitialHangoutDataService(hangoutId: string): Promise<AxiosResponse<InitialHangoutData>> {
  return axios.get(`${hangoutsApiUrl}/details/initial?hangoutId=${hangoutId}`);
};