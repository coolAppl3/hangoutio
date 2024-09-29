export interface InfoModalConfig {
  title: string,
  description: string | null,
  btnTitle: string,
};

export function displayInfoModal(infoModalConfig: InfoModalConfig): HTMLDivElement {
  const existingInfoModal: HTMLDivElement | null = document.querySelector('#confirm-modal');
  existingInfoModal ? existingInfoModal.remove() : undefined;

  const newInfoModal: HTMLDivElement = createInfoModal(infoModalConfig);
  document.body.appendChild(newInfoModal);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      newInfoModal.classList.add('revealed');
    });
  });

  return newInfoModal;
};

function createInfoModal(infoModalConfig: InfoModalConfig): HTMLDivElement {
  const infoModal: HTMLDivElement = document.createElement('div');
  infoModal.id = 'info-modal';
  infoModalConfig.description ? infoModal.className = 'has-description' : undefined;

  const infoModalContainer: HTMLDivElement = document.createElement('div');
  infoModalContainer.id = 'info-modal-container';

  infoModalContainer.appendChild(createModalTitle(infoModalConfig.title));
  infoModalConfig.description ? infoModalContainer.appendChild(createModalDescription(infoModalConfig.description)) : undefined;
  infoModalContainer.appendChild(createModalBtn(infoModalConfig.btnTitle));

  infoModal.appendChild(infoModalContainer);

  return infoModal;
};

function createModalTitle(title: string): HTMLParagraphElement {
  const modalTitle: HTMLParagraphElement = document.createElement('p');
  modalTitle.className = 'info-modal-title';
  modalTitle.appendChild(document.createTextNode(title));

  return modalTitle;
};

function createModalDescription(description: string): HTMLParagraphElement {
  const modalDescription: HTMLParagraphElement = document.createElement('p');
  modalDescription.className = 'info-modal-description';
  modalDescription.appendChild(document.createTextNode(description));

  return modalDescription;
};

function createModalBtn(btnTitle: string): HTMLButtonElement {
  const modalBtn: HTMLButtonElement = document.createElement('button');
  modalBtn.id = 'info-modal-btn';
  modalBtn.setAttribute('type', 'button');
  modalBtn.appendChild(document.createTextNode(btnTitle));

  return modalBtn;
};