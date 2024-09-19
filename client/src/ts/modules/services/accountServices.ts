import axios, { AxiosResponse } from "../../../../node_modules/axios/index";

const accountsApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/accounts`
  : `https://${window.location.hostname}/api/accounts`;
// 

export interface AccountSignInBody {
  email: string,
  password: string,
};

export interface AccountSignInData extends AxiosResponse {
  data: {
    success: true,
    resData: {
      authToken: string,
    },
  },
};

export async function accountSignInService(requestBody: AccountSignInBody): Promise<AccountSignInData> {
  return axios.post(`${accountsApiUrl}/signIn`, requestBody);
};