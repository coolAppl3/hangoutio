import { createDivElement } from "./domUtils";

export default class LoadingModal {
  public static display(): void {
    const existingLoadingModal: HTMLDivElement | null = document.querySelector('#loading-modal');
    if (existingLoadingModal) {
      return;
    };

    const newLoadingModal: HTMLDivElement = createDivElement(null, 'loading-modal');
    newLoadingModal.appendChild(createDivElement('loading-modal-spinner'));

    document.body.appendChild(newLoadingModal);
  };

  public static remove(): void {
    const loadingModal: HTMLDivElement | null = document.querySelector('#loading-modal');
    loadingModal?.remove();
  };
};