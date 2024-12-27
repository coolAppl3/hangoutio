import axios, { AxiosResponse } from "../../../../node_modules/axios/index";
import { AvailabilitySlot } from "../hangout/hangoutDataTypes";

axios.defaults.withCredentials = true;

const availabilitySlotsApiUrl: string = window.location.hostname === 'localhost'
  ? `http://${window.location.hostname}:5000/api/availabilitySlots`
  : `https://${window.location.hostname}/api/availabilitySlots`;
//

interface HangoutAvailabilitySlotsData {
  availabilitySlots: AvailabilitySlot[],
};

export async function getHangoutAvailabilitySlotsServices(hangoutId: string, hangoutMemberId: number): Promise<AxiosResponse<HangoutAvailabilitySlotsData>> {
  return axios.get(`${availabilitySlotsApiUrl}?hangoutId=${hangoutId}&hangoutMemberId=${hangoutMemberId}`);
};