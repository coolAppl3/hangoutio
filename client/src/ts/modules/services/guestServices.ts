import axios, { AxiosResponse } from "axios";

axios.defaults.withCredentials = true;

const guestApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/guests`
  : `https://${window.location.hostname}/api/guests`;
// 

export interface GuestSignInBody {
  username: string,
  password: string,
};

export async function guestSignInService(requestBody: GuestSignInBody): Promise<AxiosResponse> {
  return axios.post(`${guestApiUrl}/signIn`, requestBody);
};