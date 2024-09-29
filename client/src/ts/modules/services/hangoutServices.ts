import axios, { AxiosResponse } from "../../../../node_modules/axios/index";

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

export interface AccountLeaderHangoutData extends AxiosResponse {
  data: {
    success: true,
    resData: {
      hangoutID: string,
      hangoutMemberID: number,
    },
  },
};

export async function createAccountLeaderHangoutService(authToken: string, requestBody: AccountLeaderHangoutBody): Promise<AccountLeaderHangoutData> {
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

export interface GuestLeaderHangoutData extends AxiosResponse {
  data: {
    success: true,
    resData: {
      hangoutID: string,
      authToken: string,
    },
  },
};

export async function createGuestLeaderHangoutService(requestBody: GuestLeaderHangoutBody): Promise<GuestLeaderHangoutData> {
  return axios.post(`${hangoutsApiUrl}/create/guestLeader`, requestBody);
};