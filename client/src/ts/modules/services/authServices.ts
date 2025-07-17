import axios, { AxiosResponse } from "axios";

axios.defaults.withCredentials = true;

const authApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/auth`
  : `https://${window.location.hostname}/api/auth`;
// 

export async function signOutService(): Promise<AxiosResponse> {
  return axios.post(`${authApiUrl}/signOut`);
};