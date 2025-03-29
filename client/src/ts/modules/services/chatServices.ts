import axios, { AxiosResponse } from "../../../../node_modules/axios/index";
import { ChatMessage } from "../hangout/hangoutTypes";

axios.defaults.withCredentials = true;

const chatApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/chat`
  : `https://${window.location.hostname}/api/chat`;
//

interface SendHangoutMessageBody {
  hangoutMemberId: number,
  hangoutId: string,
  messageContent: string,
};

export function sendHangoutMessageService(requestBody: SendHangoutMessageBody): Promise<AxiosResponse<ChatMessage>> {
  return axios.post(`${chatApiUrl}`, requestBody);
};

// --- --- ---

export function getHangoutMessagesService(hangoutId: string, hangoutMemberId: number, messageOffset: number): Promise<AxiosResponse<ChatMessage[]>> {
  return axios.get(`${chatApiUrl}?hangoutId=${hangoutId}&hangoutMemberId=${hangoutMemberId}&messageOffset=${messageOffset}`);
};