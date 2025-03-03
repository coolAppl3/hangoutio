export default class LoadingModal {
  public static display(): void {
    const existingLoadingModal: HTMLDivElement | null = document.querySelector('#loading-modal');
    if (existingLoadingModal) {
      return;
    };

    const newLoadingModal: HTMLDivElement = this.createModal();
    document.body.appendChild(newLoadingModal);
  };

  public static remove(): void {
    const loadingModal: HTMLDivElement | null = document.querySelector('#loading-modal');
    loadingModal?.remove();
  };

  private static createModal(): HTMLDivElement {
    const loadingModal: HTMLDivElement = document.createElement('div');
    loadingModal.id = 'loading-modal';

    loadingModal.appendChild(this.createModalSpinner());
    return loadingModal;
  };

  private static createModalSpinner(): HTMLDivElement {
    const modalSpinner: HTMLDivElement = document.createElement('div');
    modalSpinner.className = 'loading-modal-spinner';

    return modalSpinner;
  };
};