import axios, { AxiosResponse } from "../../../../node_modules/axios/index";

const guestApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/guests`
  : `https://${window.location.hostname}/api/guests`;
// 

export interface GuestSignInBody {
  username: string,
  password: string,
};

export interface GuestSignInData {
  success: true,
  resData: {
    authToken: string,
    hangoutID: string,
  },
};

export async function guestSignInService(requestBody: GuestSignInBody): Promise<AxiosResponse<GuestSignInData>> {
  return axios.post(`${guestApiUrl}/signIn`, requestBody);
};