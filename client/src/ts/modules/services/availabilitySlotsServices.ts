import axios, { AxiosResponse } from "../../../../node_modules/axios/index";
import { AvailabilitySlot } from "../hangout/hangoutTypes";

axios.defaults.withCredentials = true;

const availabilitySlotsApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/availabilitySlots`
  : `https://${window.location.hostname}/api/availabilitySlots`;
//

interface GetHangoutAvailabilitySlotsData {
  availabilitySlots: AvailabilitySlot[],
};

export async function getHangoutAvailabilitySlotsService(hangoutId: string, hangoutMemberId: number): Promise<AxiosResponse<GetHangoutAvailabilitySlotsData>> {
  return axios.get(`${availabilitySlotsApiUrl}?hangoutId=${hangoutId}&hangoutMemberId=${hangoutMemberId}`);
};

// --- --- ---

export interface AddHangoutAvailabilitySlotBody {
  hangoutId: string,
  hangoutMemberId: number,
  slotStartTimestamp: number,
  slotEndTimestamp: number,
};

interface AddHangoutAvailabilitySlotData {
  availabilitySlotId: number,
};

export async function addHangoutAvailabilitySlotService(requestBody: AddHangoutAvailabilitySlotBody): Promise<AxiosResponse<AddHangoutAvailabilitySlotData>> {
  return axios.post(availabilitySlotsApiUrl, requestBody);
};

// --- --- ---

export interface EditHangoutAvailabilitySlotBody {
  hangoutId: string,
  hangoutMemberId: number,
  availabilitySlotId: number,
  slotStartTimestamp: number,
  slotEndTimestamp: number,
};

export async function editHangoutAvailabilitySlotService(requestBody: EditHangoutAvailabilitySlotBody): Promise<AxiosResponse> {
  return axios.patch(availabilitySlotsApiUrl, requestBody);
};

// --- --- ---

export interface DeleteHangoutAvailabilitySlotBody {
  hangoutId: string,
  hangoutMemberId: number,
  availabilitySlotId: number,
};

export async function deleteHangoutAvailabilitySlotService(requestBody: DeleteHangoutAvailabilitySlotBody): Promise<AxiosResponse> {
  const { hangoutId, hangoutMemberId, availabilitySlotId } = requestBody;
  const requestUrl: string = `${availabilitySlotsApiUrl}?hangoutId=${hangoutId}&hangoutMemberId=${hangoutMemberId}&availabilitySlotId=${availabilitySlotId}`;

  return axios.delete(requestUrl);
};

// --- --- --- 

export interface ClearHangoutAvailabilitySlotBody {
  hangoutId: string,
  hangoutMemberId: number,
};

export async function clearHangoutAvailabilitySlotService(requestBody: ClearHangoutAvailabilitySlotBody): Promise<AxiosResponse> {
  const { hangoutId, hangoutMemberId } = requestBody;
  const requestUrl: string = `${availabilitySlotsApiUrl}/clear?hangoutId=${hangoutId}&hangoutMemberId=${hangoutMemberId}`;

  return axios.delete(requestUrl);
};