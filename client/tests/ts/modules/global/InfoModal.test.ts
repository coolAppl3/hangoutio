import { InfoModal } from '../../../../src/ts/modules/global/InfoModal';

beforeEach(() => {
  const newBody: HTMLBodyElement = document.createElement('body');
  document.documentElement.replaceChild(newBody, document.body);
});

describe('display()', () => {
  it('should create an info modal with all the data passed into it, then append it to the body', () => {
    const config = {
      title: 'Some title.',
      description: 'Some description.',
      btnTitle: 'Okay',
    };

    InfoModal.display(config);

    const infoModal: HTMLDivElement | null = document.querySelector('#info-modal');
    expect(infoModal).toBeInstanceOf(HTMLDivElement);
    expect(infoModal?.className).toBe('has-description');

    const infoModalContainer: HTMLDivElement | null | undefined = infoModal?.querySelector('#info-modal-container');
    expect(infoModalContainer).toBeInstanceOf(HTMLDivElement);

    const infoModalTitle: HTMLParagraphElement | null | undefined = infoModalContainer?.querySelector('.info-modal-title');
    expect(infoModalTitle).toBeInstanceOf(HTMLParagraphElement);
    expect(infoModalTitle?.textContent).toBe(config.title);

    const descriptionContainer: HTMLDivElement | null | undefined = infoModalContainer?.querySelector('.description-container');
    expect(descriptionContainer).toBeInstanceOf(HTMLDivElement);

    const descriptionElement: HTMLParagraphElement | null | undefined = descriptionContainer?.querySelector('.info-modal-description');
    expect(descriptionElement).toBeInstanceOf(HTMLParagraphElement);
    expect(descriptionElement?.textContent).toBe(config.description);

    const infoModalBtn: HTMLButtonElement | null | undefined = infoModal?.querySelector('#info-modal-btn');
    expect(infoModalBtn).toBeInstanceOf(HTMLButtonElement);
    expect(infoModalBtn?.textContent).toBe(config.btnTitle);
  });

  it('should create multiple description paragraph elements if the description in the config is separated using \n', () => {
    const config = {
      title: 'Some title.',
      description: 'Some description.\nSome other description.',
      btnTitle: 'Okay',
    };

    InfoModal.display(config);

    const descriptionContainer: HTMLDivElement | null = document.querySelector('#info-modal .description-container');
    expect(descriptionContainer).toBeInstanceOf(HTMLDivElement);

    const descriptionElementsNodeList: NodeListOf<HTMLParagraphElement> | undefined = descriptionContainer?.querySelectorAll('.info-modal-description');
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

  it('should not create a paragraph element if the title is null in the config', () => {
    const config = {
      title: null,
      description: 'Some description.',
      btnTitle: 'Okay',
    };

    InfoModal.display(config);

    const infoModalTitle: HTMLParagraphElement | null = document.querySelector('#info-modal .info-modal-title');
    expect(infoModalTitle).toBeNull();
  });

  it('should not create a description container if the description is null in the config', () => {
    const config = {
      title: 'Some title.',
      description: null,
      btnTitle: 'Okay',
    };

    InfoModal.display(config);

    const descriptionContainer: HTMLDivElement | null = document.querySelector('#info-modal .description-container');
    expect(descriptionContainer).toBeNull();

    const descriptionElement: HTMLParagraphElement | null = document.querySelector('#info-modal .info-modal-description');
    expect(descriptionElement).toBeNull();
  });
});

describe('remove()', () => {
  it('should remove the info modal from the body, if one is found, but only after 150 milliseconds to ensure its animated out properly', () => {
    InfoModal.display({
      title: 'Some title.',
      description: 'Some description.',
      btnTitle: 'Okay',
    });

    jest.useFakeTimers();
    InfoModal.remove();

    expect(document.querySelector('#info-modal')).toBeInstanceOf(HTMLDivElement);

    jest.advanceTimersByTime(150);
    expect(document.querySelector('#info-modal')).toBeNull();

    jest.clearAllTimers();
    jest.useRealTimers();
  });
});