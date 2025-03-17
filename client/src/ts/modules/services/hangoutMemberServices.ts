import axios, { AxiosResponse } from "../../../../node_modules/axios/index";

axios.defaults.withCredentials = true;

const hangoutMembersApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/hangoutMembers`
  : `https://${window.location.hostname}/api/hangoutMembers`;
//

export interface JoinHangoutAsAccountBody {
  hangoutId: string,
  hangoutPassword: string | null,
};

export async function joinHangoutAsAccountService(requestBody: JoinHangoutAsAccountBody): Promise<AxiosResponse> {
  return axios.post(`${hangoutMembersApiUrl}/joinHangout/account`, requestBody);
};

// --- --- ---

export interface JoinHangoutAsGuestBody {
  hangoutId: string,
  hangoutPassword: string | null,
  username: string,
  password: string,
  displayName: string,
};

interface JoinHangoutAsGuestData {
  authSessionCreated: boolean,
};

export async function joinHangoutAsGuestService(requestBody: JoinHangoutAsGuestBody): Promise<AxiosResponse<JoinHangoutAsGuestData>> {
  return axios.post(`${hangoutMembersApiUrl}/joinHangout/guest`, requestBody);
};

// --- --- ---

export async function leaveHangoutService(hangoutMemberId: number, hangoutId: string): Promise<AxiosResponse> {
  return axios.delete(`${hangoutMembersApiUrl}/leave?hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);
};