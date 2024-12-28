import { HangoutMember, HangoutsDetails } from "./hangoutTypes";

interface GlobalHangoutState {
  webSocketConnected: boolean,

  data: null | {
    hangoutId: string,
    hangoutMemberId: number,
    hangoutMembers: HangoutMember[],

    isLeader: boolean,
    isPasswordProtected: boolean,
    decryptedHangoutPassword: string | null,

    availabilitySlotsCount: number,
    suggestionsCount: number,
    votesCount: number,

    hangoutDetails: HangoutsDetails,
  },
};

export const globalHangoutState: GlobalHangoutState = { webSocketConnected: false, data: null };