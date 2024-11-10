interface GlobalHangoutState {
  hangoutId: string,
  hangoutMemberId: number,

  hangoutTitle: string,
  hangoutPassword: string,
  memberLimit: number,

  currentStep: string,
  nextStep: string,
  nextStepTimestamp: number,
  conclusionTimestamp: number,

  webSocketConnected: boolean
};

export const globalHangoutState: GlobalHangoutState | null = null;