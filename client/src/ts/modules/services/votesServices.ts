import axios, { AxiosResponse } from "../../../../node_modules/axios/index";

axios.defaults.withCredentials = true;

const votesApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/votes`
  : `https://${window.location.hostname}/api/votes`;
//

interface AddHangoutVoteBody {
  hangoutId: string,
  hangoutMemberId: number,
  suggestionId: number,
};

export async function addHangoutVoteService(requestBody: AddHangoutVoteBody): Promise<AxiosResponse<AddHangoutVoteBody>> {
  return axios.post(votesApiUrl, requestBody);
};

// --- --- ---

interface DeleteHangoutVoteBody {
  suggestionId: number,
  hangoutMemberId: number,
  hangoutId: string,
};

export async function removeHangoutVoteService(requestBody: DeleteHangoutVoteBody): Promise<AxiosResponse> {
  const { suggestionId, hangoutMemberId, hangoutId } = requestBody;
  return axios.delete(`${votesApiUrl}?suggestionId=${suggestionId}&hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);
};