import { ConfirmModal } from "../global/ConfirmModal";
import popup from "../global/popup";
import { globalHangoutState } from "./globalHangoutState";

export function handleIrrecoverableError(): void {
  const confirmModal: HTMLDivElement = ConfirmModal.display({
    title: 'Something went wrong.',
    description: 'We ran into an unexpected error while fetching the data for you.',
    confirmBtnTitle: 'Reload page',
    cancelBtnTitle: 'Go to homepage',
    extraBtnTitle: null,
    isDangerousAction: false,
  });

  confirmModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLButtonElement)) {
      return;
    };

    if (e.target.id === 'confirm-modal-confirm-btn') {
      window.location.reload();
      return;
    };

    if (e.target.id === 'confirm-modal-cancel-btn') {
      window.location.href = 'home';
    };
  });
};

export function calculateHangoutConclusionTimestamp(): number | null {
  if (!globalHangoutState.data) {
    return null;
  };

  const { created_on_timestamp, availability_period, suggestions_period, voting_period } = globalHangoutState.data.hangoutDetails;
  const hangoutConclusionTimestamp: number = created_on_timestamp + availability_period + suggestions_period + voting_period;

  return hangoutConclusionTimestamp;
};


export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    popup('Copied to clipboard.', 'success');

  } catch (err: unknown) {
    console.log(err);
    popup('Failed to copy to clipboard.', 'error');
  };
};