export interface ConfirmModalConfig {
  title: string,
  description: string | null,
  confirmBtnTitle: string,
  cancelBtnTitle: string,
  extraBtnTitle: string | null,
  isDangerousAction: boolean,
};

export class ConfirmModal {
  public static display(config: ConfirmModalConfig): HTMLDivElement {
    const existingConfirmModal: HTMLDivElement | null = document.querySelector('#confirm-modal');
    existingConfirmModal ? existingConfirmModal.remove() : undefined;

    const newConfirmModal: HTMLDivElement = this.createConfirmModal(config);
    document.body.appendChild(newConfirmModal);

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
    const confirmModal: HTMLDivElement = document.createElement('div');
    confirmModal.id = 'confirm-modal';

    const confirmModalContainer: HTMLDivElement = document.createElement('div');
    confirmModalContainer.id = 'confirm-modal-container';

    confirmModalContainer.appendChild(this.createModalTitle(config.title));
    if (config.description) {
      confirmModalContainer.appendChild(this.createModalTitle(config.description));
      confirmModal.className = 'has-description';
    };

    confirmModalContainer.appendChild(this.createBtnContainer(config));
    confirmModal.appendChild(confirmModalContainer);

    return confirmModal;
  };

  private static createModalTitle(title: string): HTMLParagraphElement {
    const paragraphElement: HTMLParagraphElement = document.createElement('p');
    paragraphElement.className = 'confirm-modal-title';
    paragraphElement.appendChild(document.createTextNode(title));

    return paragraphElement;
  };

  private static createModalDescription(description: string): HTMLParagraphElement {
    const paragraphElement: HTMLParagraphElement = document.createElement('p');
    paragraphElement.className = 'confirm-modal-description';
    paragraphElement.appendChild(document.createTextNode(description));

    return paragraphElement;
  };

  private static createBtnContainer(config: ConfirmModalConfig): HTMLDivElement {
    const btnContainer: HTMLDivElement = document.createElement('div');
    btnContainer.className = 'btn-container';

    btnContainer.appendChild(this.createBtnElement('confirm-btn', config.confirmBtnTitle, config.isDangerousAction));
    btnContainer.appendChild(this.createBtnElement('cancel-btn', config.cancelBtnTitle));
    config.extraBtnTitle ? btnContainer.appendChild(this.createBtnElement('other-btn', config.extraBtnTitle)) : undefined;

    return btnContainer;
  };

  private static createBtnElement(btnIdEnding: string, title: string, isDangerousAction?: boolean): HTMLButtonElement {
    const btnElement: HTMLButtonElement = document.createElement('button');
    btnElement.id = `confirm-modal-${btnIdEnding}`;
    btnElement.appendChild(document.createTextNode(title));

    isDangerousAction ? btnElement.className = 'danger' : undefined;

    return btnElement;
  };
};