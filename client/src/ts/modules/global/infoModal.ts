import { createBtnElement, createDivElement, createParagraphElement } from "./domUtils";

interface InfoModalConfig {
  title: string | null,
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
      if (!(e.target instanceof HTMLButtonElement)) {
        return;
      };

      if (e.target.id === 'info-modal-btn') {
        InfoModal.remove();
      };
    });
  };

  private static createInfoModal(config: InfoModalConfig): HTMLDivElement {
    const infoModal: HTMLDivElement = createDivElement(null, 'info-modal');
    infoModal.setAttribute('tabindex', '0');
    config.description && (infoModal.className = 'has-description');

    const infoModalContainer: HTMLDivElement = createDivElement(null, 'info-modal-container');
    config.title && infoModalContainer.appendChild(createParagraphElement('info-modal-title', config.title));

    if (config.description) {
      const descriptionContainer: HTMLDivElement = createDivElement('description-container');

      for (const descriptionLine of config.description.split('\n')) {
        descriptionContainer.appendChild(createParagraphElement('info-modal-description', descriptionLine));
      };

      infoModalContainer.appendChild(descriptionContainer);
    };

    infoModalContainer.appendChild(createBtnElement(null, config.btnTitle, 'info-modal-btn'));

    infoModal.appendChild(infoModalContainer);
    return infoModal;
  };
};