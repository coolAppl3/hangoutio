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

export interface UpdateHangoutPasswordBody {
  hangoutId: string,
  hangoutMemberId: number,
  newPassword: string | null,
};

export async function updateHangoutPasswordService(requestBody: UpdateHangoutPasswordBody): Promise<AxiosErrorResponseData> {
  return axios.patch(`${hangoutsApiUrl}/details/updatePassword`, requestBody);
};

// --- --- ---

export interface UpdateHangoutMembersLimitBody {
  hangoutId: string,
  hangoutMemberId: number,
  newMembersLimit: number,
};

export async function updateHangoutMembersLimitService(requestBody: UpdateHangoutMembersLimitBody): Promise<AxiosResponse> {
  return axios.patch(`${hangoutsApiUrl}/details/changeMembersLimit`, requestBody);
};

// --- --- ---

export interface UpdateHangoutStagesBody {
  hangoutId: string,
  hangoutMemberId: number,
  newAvailabilityPeriod: number,
  newSuggestionsPeriod: number,
  newVotingPeriod: number,
};

export interface UpdateHangoutStagesData {
  newConclusionTimestamp: number,
};

export async function updateHangoutStagesService(requestBody: UpdateHangoutStagesBody): Promise<AxiosResponse<UpdateHangoutStagesData>> {
  return axios.patch(`${hangoutsApiUrl}/details/stages/update`, requestBody);
};

// --- --- ---

export interface ProgressHangoutStagBody {
  hangoutId: string,
  hangoutMemberId: number,
};

export interface ProgressHangoutStageData {
  availability_period: number,
  suggestions_period: number,
  voting_period: number,
  conclusion_timestamp: number,
  stage_control_timestamp: number,
  current_stage: number,
  is_concluded: boolean,
};

export async function progressHangoutStageService(requestBody: ProgressHangoutStagBody): Promise<AxiosResponse<ProgressHangoutStageData>> {
  return axios.patch(`${hangoutsApiUrl}/details/stages/progress`, requestBody);
};

// --- --- ---

export async function deleteHangoutService(hangoutMemberId: number, hangoutId: string): Promise<AxiosResponse> {
  return axios.delete(`${hangoutsApiUrl}?hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);
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