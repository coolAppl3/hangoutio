import axios, { AxiosResponse } from "../../../../node_modules/axios/index";

axios.defaults.withCredentials = true;

const authApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/auth`
  : `https://${window.location.hostname}/api/auth`;
// 

export async function signOUtService(): Promise<AxiosResponse> {
  return axios.post(`${authApiUrl}/signOut`);
};