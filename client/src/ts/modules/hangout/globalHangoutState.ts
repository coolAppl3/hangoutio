interface GlobalHangoutState {
  hangoutID: string | null,
  hangoutMemberID: number | null,

  inHangoutFeed: boolean,
};

export const globalHangoutState: GlobalHangoutState = {
  hangoutID: 'dummyHangoutID',
  hangoutMemberID: 37,

  inHangoutFeed: false,
};