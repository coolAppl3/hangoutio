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
  success: true,
  resData: {
    availabilitySlotId: number,
  },
};

export async function addHangoutAvailabilitySlotService(requestBody: AddHangoutAvailabilitySlotBody): Promise<AxiosResponse<AddHangoutAvailabilitySlotData>> {
  return axios.post(availabilitySlotsApiUrl, requestBody);
};