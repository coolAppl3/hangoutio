interface GlobalHangoutState {
  hangoutId: string,
  hangoutMemberId: number,

  hangoutTitle: string,
  hangoutPassword: string,
  membersLimit: number,

  currentStage: string,
  nextStage: string,

  webSocketConnected: boolean
};

export const globalHangoutState: GlobalHangoutState | null = null;