import { HangoutMember, HangoutsDetails } from "./hangoutTypes";

interface GlobalHangoutState {
  webSocketConnected: boolean,
  hangoutWebSocket: WebSocket | null,

  data: null | {
    hangoutId: string,
    hangoutMemberId: number,
    hangoutMembers: HangoutMember[],
    hangoutMembersMap: Map<number, string>,

    isLeader: boolean,
    isPasswordProtected: boolean,
    decryptedHangoutPassword: string | null,

    availabilitySlotsCount: number,
    suggestionsCount: number,
    votesCount: number,

    hangoutDetails: HangoutsDetails,
  },
};

export const globalHangoutState: GlobalHangoutState = { webSocketConnected: false, hangoutWebSocket: null, data: null };