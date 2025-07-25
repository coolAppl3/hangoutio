import { createBtnElement, createDivElement, createParagraphElement } from "./domUtils";

interface ConfirmModalConfig {
  title: string | null,
  description: string | null,
  confirmBtnTitle: string,
  cancelBtnTitle: string,
  extraBtnTitle: string | null,
  isDangerousAction: boolean,
};

export class ConfirmModal {
  public static display(config: ConfirmModalConfig): HTMLDivElement {
    const existingConfirmModal: HTMLDivElement | null = document.querySelector('#confirm-modal');
    existingConfirmModal?.remove();

    const newConfirmModal: HTMLDivElement = this.createConfirmModal(config);
    document.body.appendChild(newConfirmModal);
    newConfirmModal.focus();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        newConfirmModal.classList.add('revealed');
      });
    });

    return newConfirmModal;
  };

  public static remove(): void {
    const confirmModal: HTMLDivElement | null = document.querySelector('#confirm-modal');
    confirmModal?.classList.remove('revealed');

    setTimeout(() => confirmModal?.remove(), 150);
  };

  private static createConfirmModal(config: ConfirmModalConfig): HTMLDivElement {
    const confirmModal: HTMLDivElement = createDivElement(null, 'confirm-modal');
    confirmModal.setAttribute('tabindex', '0');
    config.description && (confirmModal.className = 'has-description');

    const confirmModalContainer: HTMLDivElement = createDivElement(null, 'confirm-modal-container');
    config.title && confirmModalContainer.appendChild(createParagraphElement('confirm-modal-title', config.title));

    if (config.description) {
      const descriptionContainer: HTMLDivElement = createDivElement('description-container');

      for (const descriptionLine of config.description.split('\n')) {
        descriptionContainer.appendChild(createParagraphElement('confirm-modal-description', descriptionLine));
      };

      confirmModalContainer.appendChild(descriptionContainer);
    };

    confirmModalContainer.appendChild(this.createBtnContainer(config));
    confirmModal.appendChild(confirmModalContainer);

    return confirmModal;
  };

  private static createBtnContainer(config: ConfirmModalConfig): HTMLDivElement {
    const btnContainer: HTMLDivElement = createDivElement('btn-container');

    const confirmBtn: HTMLButtonElement = createBtnElement(config.isDangerousAction ? 'danger' : null, config.confirmBtnTitle, 'confirm-modal-confirm-btn');
    const cancelBtn: HTMLButtonElement = createBtnElement(null, config.cancelBtnTitle, 'confirm-modal-cancel-btn');

    btnContainer.appendChild(confirmBtn);
    btnContainer.appendChild(cancelBtn);

    if (config.extraBtnTitle) {
      const extraBtn: HTMLButtonElement = createBtnElement(null, config.extraBtnTitle, 'confirm-modal-other-btn');
      btnContainer.appendChild(extraBtn);
    };

    return btnContainer;
  };
};