import { ConfirmModal } from "../global/ConfirmModal";

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