export interface InfoModalConfig {
  title: string,
  description: string | null,
  btnTitle: string,
};

interface InfoModalOptions {
  simple: boolean,
};

export class InfoModal {
  public static display(infoModalConfig: InfoModalConfig, options?: InfoModalOptions): HTMLDivElement {
    const existingInfoModal: HTMLDivElement | null = document.querySelector('#info-modal');
    existingInfoModal?.remove();

    const newInfoModal: HTMLDivElement = this.createInfoModal(infoModalConfig);
    document.body.appendChild(newInfoModal);
    newInfoModal.focus();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        newInfoModal.classList.add('revealed');
      });
    });

    if (options?.simple) {
      this.addSimpleClosingEventListener(newInfoModal);
    };

    return newInfoModal;
  };

  public static remove(): void {
    const infoModal: HTMLDivElement | null = document.querySelector('#info-modal');

    if (!infoModal) {
      return;
    };

    infoModal.classList.remove('revealed');
    setTimeout(() => infoModal.remove(), 150);
  };

  private static addSimpleClosingEventListener(infoModal: HTMLDivElement): void {
    infoModal.addEventListener('click', (e: MouseEvent) => {
      if (!(e.target instanceof HTMLElement)) {
        return;
      };

      if (e.target.id === 'info-modal-btn') {
        InfoModal.remove();
      };
    });
  };

  private static createInfoModal(config: InfoModalConfig): HTMLDivElement {
    const infoModal: HTMLDivElement = document.createElement('div');
    infoModal.id = 'info-modal';
    infoModal.setAttribute('tabindex', '0');
    config.description && (infoModal.className = 'has-description');

    const infoModalContainer: HTMLDivElement = document.createElement('div');
    infoModalContainer.id = 'info-modal-container';

    infoModalContainer.appendChild(this.createModalTitle(config.title));

    if (config.description) {
      const descriptionContainer: HTMLDivElement = this.createDescriptionContainer();

      for (const descriptionLine of config.description.split('\n')) {
        descriptionContainer.appendChild(this.createModalDescription(descriptionLine));
      };

      infoModalContainer.appendChild(descriptionContainer);
    };

    infoModalContainer.appendChild(this.createModalBtn(config.btnTitle));

    infoModal.appendChild(infoModalContainer);
    return infoModal;
  };

  private static createModalTitle(title: string): HTMLParagraphElement {
    const modalTitle: HTMLParagraphElement = document.createElement('p');
    modalTitle.className = 'info-modal-title';
    modalTitle.appendChild(document.createTextNode(title));

    return modalTitle;
  };

  private static createDescriptionContainer(): HTMLDivElement {
    const descriptionContainer: HTMLDivElement = document.createElement('div');
    descriptionContainer.className = 'description-container';

    return descriptionContainer;
  };

  private static createModalDescription(description: string): HTMLParagraphElement {
    const modalDescription: HTMLParagraphElement = document.createElement('p');
    modalDescription.className = 'info-modal-description';
    modalDescription.appendChild(document.createTextNode(description));

    return modalDescription;
  };

  private static createModalBtn(btnTitle: string): HTMLButtonElement {
    const modalBtn: HTMLButtonElement = document.createElement('button');
    modalBtn.id = 'info-modal-btn';
    modalBtn.setAttribute('type', 'button');
    modalBtn.appendChild(document.createTextNode(btnTitle));

    return modalBtn;
  };
};