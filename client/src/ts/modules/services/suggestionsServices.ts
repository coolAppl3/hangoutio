import axios, { AxiosResponse } from "../../../../node_modules/axios/index";
import { Suggestion, SuggestionLike, Vote } from "../hangout/hangoutTypes";

axios.defaults.withCredentials = true;

const suggestionsApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/suggestions`
  : `https://${window.location.hostname}/api/suggestions`;
//

export interface AddHangoutSuggestionBody {
  hangoutId: string,
  hangoutMemberId: number,
  suggestionTitle: string,
  suggestionDescription: string,
  suggestionStartTimestamp: number,
  suggestionEndTimestamp: number,
};

interface AddHangoutSuggestionData {
  suggestionId: number,
};

export function addHangoutSuggestionService(requestBody: AddHangoutSuggestionBody): Promise<AxiosResponse<AddHangoutSuggestionData>> {
  return axios.post(suggestionsApiUrl, requestBody);
};

// --- --- ---

interface EditHangoutSuggestionBody {
  hangoutId: string,
  hangoutMemberId: number,
  suggestionId: number,
  suggestionTitle: string,
  suggestionDescription: string,
  suggestionStartTimestamp: number,
  suggestionEndTimestamp: number,
};

export function editHangoutSuggestionService(requestBody: EditHangoutSuggestionBody): Promise<AxiosResponse> {
  return axios.patch(suggestionsApiUrl, requestBody);
};

// --- --- ---

interface DeleteHangoutSuggestionBody {
  suggestionId: number,
  hangoutMemberId: number,
  hangoutId: string,
};

export function deleteHangoutSuggestionService(requestBody: DeleteHangoutSuggestionBody): Promise<AxiosResponse> {
  const { suggestionId, hangoutMemberId, hangoutId } = requestBody;
  return axios.delete(`${suggestionsApiUrl}?suggestionId=${suggestionId}&hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);
};

// --- --- ---

interface ClearHangoutSuggestionsBody {
  hangoutMemberId: number,
  hangoutId: string,
};

interface ClearHangoutSuggestionsData {
  deletedSuggestions: number,
};

export function clearHangoutSuggestionsService(requestBody: ClearHangoutSuggestionsBody): Promise<AxiosResponse<ClearHangoutSuggestionsData>> {
  const { hangoutMemberId, hangoutId } = requestBody;
  return axios.delete(`${suggestionsApiUrl}/clear?hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);
};

// --- --- ---

interface DeleteHangoutSuggestionAsLeaderBody {
  suggestionId: number,
  hangoutMemberId: number,
  hangoutId: string,
};

export function deleteHangoutSuggestionAsLeaderService(requestBody: DeleteHangoutSuggestionAsLeaderBody): Promise<AxiosResponse> {
  const { suggestionId, hangoutMemberId, hangoutId } = requestBody;
  return axios.delete(`${suggestionsApiUrl}/leader?suggestionId=${suggestionId}&hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);
};

// --- --- ---

interface GetHangoutSuggestionsBody {
  hangoutMemberId: number,
  hangoutId: string,
};

interface GetHangoutSuggestionsData {
  suggestions: Suggestion[],
  memberLikes: SuggestionLike[],
  memberVotes: Vote[],
}

export function getHangoutSuggestionsService(requestBody: GetHangoutSuggestionsBody): Promise<AxiosResponse<GetHangoutSuggestionsData>> {
  const { hangoutMemberId, hangoutId } = requestBody;
  return axios.get(`${suggestionsApiUrl}?hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);
};

// --- --- ---

interface AddSuggestionLikeBody {
  suggestionId: number,
  hangoutMemberId: number,
  hangoutId: string,
};

interface AddSuggestionLikeData {
  suggestionLikeId: number,
};

export function addHangoutSuggestionLikeService(requestBody: AddSuggestionLikeBody): Promise<AxiosResponse<AddSuggestionLikeData>> {
  return axios.post(`${suggestionsApiUrl}/likes`, requestBody);
};

// --- --- ---

interface DeleteSuggestionLikeBody {
  suggestionLikeId: number,
  hangoutMemberId: number,
  hangoutId: string,
};

export function deleteHangoutSuggestionLikeService(requestBody: DeleteSuggestionLikeBody): Promise<AxiosResponse> {
  const { suggestionLikeId, hangoutMemberId, hangoutId } = requestBody;
  return axios.delete(`${suggestionsApiUrl}?suggestionLikeId=${suggestionLikeId}&hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);
};