import { ConfirmModal } from '../../../../src/ts/modules/global/ConfirmModal';

beforeEach(() => {
  const newBody: HTMLBodyElement = document.createElement('body');
  document.documentElement.replaceChild(newBody, document.body);
});

describe('display()', () => {
  it('should create a confirm modal with all the data passed into it, then append it to the body', () => {
    const config = {
      title: 'Some title.',
      description: 'Some description.',
      confirmBtnTitle: 'Confirm',
      cancelBtnTitle: 'Cancel',
      extraBtnTitle: 'Other Option',
      isDangerousAction: false,
    };

    ConfirmModal.display(config);

    const confirmModal: HTMLDivElement | null = document.querySelector('#confirm-modal');
    expect(confirmModal).toBeInstanceOf(HTMLDivElement);
    expect(confirmModal?.className).toBe('has-description');

    const confirmModalContainer: HTMLDivElement | null | undefined = confirmModal?.querySelector('#confirm-modal-container');
    expect(confirmModalContainer).toBeInstanceOf(HTMLDivElement);

    const confirmModalTitle: HTMLParagraphElement | null | undefined = confirmModalContainer?.querySelector('.confirm-modal-title');
    expect(confirmModalTitle).toBeInstanceOf(HTMLParagraphElement);
    expect(confirmModalTitle?.textContent).toBe(config.title);

    const descriptionContainer: HTMLDivElement | null | undefined = confirmModalContainer?.querySelector('.description-container');
    expect(descriptionContainer).toBeInstanceOf(HTMLDivElement);

    const descriptionElement: HTMLParagraphElement | null | undefined = descriptionContainer?.querySelector('.confirm-modal-description');
    expect(descriptionElement).toBeInstanceOf(HTMLParagraphElement);
    expect(descriptionElement?.textContent).toBe(config.description);

    const btnContainer: HTMLDivElement | null | undefined = confirmModalContainer?.querySelector('.btn-container');
    expect(btnContainer).toBeInstanceOf(HTMLDivElement);

    const confirmBtn: HTMLButtonElement | null | undefined = btnContainer?.querySelector('#confirm-modal-confirm-btn');
    expect(confirmBtn).toBeInstanceOf(HTMLButtonElement);
    expect(confirmBtn?.textContent).toBe(config.confirmBtnTitle);

    const cancelBtn: HTMLButtonElement | null | undefined = btnContainer?.querySelector('#confirm-modal-cancel-btn');
    expect(cancelBtn).toBeInstanceOf(HTMLButtonElement);
    expect(cancelBtn?.textContent).toBe(config.cancelBtnTitle);

    const extraBtn: HTMLButtonElement | null | undefined = btnContainer?.querySelector('#confirm-modal-other-btn');
    expect(extraBtn).toBeInstanceOf(HTMLButtonElement);
    expect(extraBtn?.textContent).toBe(config.extraBtnTitle);
    expect(extraBtn?.className).toBe('');
  });

  it('should create multiple description paragraph elements if the description in the config is separated using \n', () => {
    const config = {
      title: 'Some title.',
      description: 'Some description.\nSome other description.',
      confirmBtnTitle: 'Confirm',
      cancelBtnTitle: 'Cancel',
      extraBtnTitle: 'Other Option',
      isDangerousAction: false,
    };

    ConfirmModal.display(config);

    const descriptionContainer: HTMLDivElement | null = document.querySelector('#confirm-modal .description-container');
    expect(descriptionContainer).toBeInstanceOf(HTMLDivElement);

    const descriptionElementsNodeList: NodeListOf<HTMLParagraphElement> | undefined = descriptionContainer?.querySelectorAll('.confirm-modal-description');
    expect(descriptionElementsNodeList?.length).toBe(2);

    if (!descriptionElementsNodeList) {
      throw new Error('Failed to create node list.');
    };

    const firstDescriptionElement: HTMLParagraphElement | undefined = descriptionElementsNodeList[0];
    const secondDescriptionElement: HTMLParagraphElement | undefined = descriptionElementsNodeList[1];

    expect(firstDescriptionElement).toBeInstanceOf(HTMLParagraphElement);
    expect(firstDescriptionElement?.textContent).toBe('Some description.');

    expect(secondDescriptionElement).toBeInstanceOf(HTMLParagraphElement);
    expect(secondDescriptionElement?.textContent).toBe('Some other description.');
  });

  it('should not create a paragraph element if the tile is null in the config', () => {
    const config = {
      title: null,
      description: 'Some description.',
      confirmBtnTitle: 'Confirm',
      cancelBtnTitle: 'Cancel',
      extraBtnTitle: 'Other Option',
      isDangerousAction: false,
    };

    ConfirmModal.display(config);

    const confirmModalTitle: HTMLParagraphElement | null = document.querySelector('#confirm-modal .confirm-modal-title');
    expect(confirmModalTitle).toBeNull();
  });

  it('should not create a description container, or description paragraph elements, and not add the has-description class if the description is null in the config', () => {
    const config = {
      title: 'Some title.',
      description: null,
      confirmBtnTitle: 'Confirm',
      cancelBtnTitle: 'Cancel',
      extraBtnTitle: 'Other Option',
      isDangerousAction: false,
    };

    ConfirmModal.display(config);

    const confirmModal: HTMLDivElement | null = document.querySelector('#confirm-modal');
    expect(confirmModal).toBeInstanceOf(HTMLDivElement);
    expect(confirmModal?.className).toBe('');

    const descriptionContainer: HTMLDivElement | null | undefined = confirmModal?.querySelector('.description-container');
    expect(descriptionContainer).toBeNull();

    const descriptionElement: HTMLParagraphElement | null | undefined = confirmModal?.querySelector('.confirm-modal-description');
    expect(descriptionElement).toBeNull();
  });

  it('should not create an extra button if the extraBtnTitle is null in the config', () => {
    const config = {
      title: 'Some Title',
      description: 'Some description.',
      confirmBtnTitle: 'Confirm',
      cancelBtnTitle: 'Cancel',
      extraBtnTitle: null,
      isDangerousAction: false,
    };

    ConfirmModal.display(config);

    const extraBtn: HTMLButtonElement | null = document.querySelector('#confirm-modal #confirm-modal-other-btn');
    expect(extraBtn).toBeNull();
  });

  it('should add a danger class to the confirm button if isDangerousAction is true in the config', () => {
    const config = {
      title: 'Some Title',
      description: 'Some description.',
      confirmBtnTitle: 'Confirm',
      cancelBtnTitle: 'Cancel',
      extraBtnTitle: 'Other Option',
      isDangerousAction: true,
    };

    ConfirmModal.display(config);

    const confirmBtn: HTMLButtonElement | null = document.querySelector('#confirm-modal #confirm-modal-confirm-btn');
    expect(confirmBtn).toBeInstanceOf(HTMLButtonElement);
    expect(confirmBtn?.textContent).toBe(config.confirmBtnTitle);
    expect(confirmBtn?.className).toBe('danger');
  });
});

describe('remove()', () => {
  it('should remove the confirm modal from the body, if one is found, but only after 150 milliseconds to ensure its animated out properly', () => {
    ConfirmModal.display({
      title: 'Some title.',
      description: 'Some description.',
      confirmBtnTitle: 'Confirm',
      cancelBtnTitle: 'Cancel',
      extraBtnTitle: null,
      isDangerousAction: false,
    });

    jest.useFakeTimers();
    ConfirmModal.remove();

    expect(document.querySelector('#confirm-modal')).toBeInstanceOf(HTMLDivElement);

    jest.advanceTimersByTime(150);
    expect(document.querySelector('#confirm-modal')).toBeNull();

    jest.clearAllTimers();
    jest.useRealTimers();
  });
});