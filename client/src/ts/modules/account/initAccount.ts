import { getAccountInfoService, HangoutInfo } from "../services/accountServices";

interface GlobalAccountState {
  isLoaded: boolean,
  hangoutInfo: HangoutInfo | null,
};

export const globalAccountState: GlobalAccountState = {
  isLoaded: false,
  hangoutInfo: null,
};

export async function initAccount(): Promise<void> {
  await getAccountInfo();
};

async function getAccountInfo(): Promise<void> {
  try {
    const hangoutInfo: HangoutInfo = (await getAccountInfoService()).data;
    // TODO: continue implementation

  } catch (err: unknown) {
    console.log(err);

  };
};

function removeLoadingSkeleton(): void {
  document.querySelector('#loading-skeleton')?.remove();
  document.querySelectorAll('section').forEach((section: HTMLElement) => section.classList.remove('hidden'));;
};