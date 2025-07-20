import axios, { AxiosResponse } from "axios";
import { Suggestion } from "../hangout/hangoutTypes";

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

export interface EditHangoutSuggestionBody {
  hangoutId: string,
  hangoutMemberId: number,
  suggestionId: number,
  suggestionTitle: string,
  suggestionDescription: string,
  suggestionStartTimestamp: number,
  suggestionEndTimestamp: number,
};

interface EditHangoutSuggestionsData {
  isMajorChange: boolean,
};

export function editHangoutSuggestionService(requestBody: EditHangoutSuggestionBody): Promise<AxiosResponse<EditHangoutSuggestionsData>> {
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
  memberLikes: number[],
  memberVotes: number[],
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

export function addHangoutSuggestionLikeService(requestBody: AddSuggestionLikeBody): Promise<AxiosResponse> {
  return axios.post(`${suggestionsApiUrl}/likes`, requestBody);
};

// --- --- ---

interface RemoveSuggestionLikeBody {
  suggestionId: number,
  hangoutMemberId: number,
  hangoutId: string,
};

export function removeHangoutSuggestionLikeService(requestBody: RemoveSuggestionLikeBody): Promise<AxiosResponse> {
  const { suggestionId, hangoutMemberId, hangoutId } = requestBody;
  return axios.delete(`${suggestionsApiUrl}/likes?suggestionId=${suggestionId}&hangoutMemberId=${hangoutMemberId}&hangoutId=${hangoutId}`);
};