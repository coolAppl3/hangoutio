import { createDivElement, createParagraphElement, createSpanElement, createBtnElement, createAnchorElement, createSvgElement } from '../../../../src/ts/modules/global/domUtils';

describe('createDivElement()', () => {
  it('should return a div element with the provided class name and ID', () => {
    const firstDiv = createDivElement('someClass', 'someId');
    expect(firstDiv).toBeInstanceOf(HTMLDivElement);
    expect(firstDiv.className).toBe('someClass');
    expect(firstDiv.id).toBe('someId');

    const secondDiv = createDivElement('someClass');
    expect(secondDiv).toBeInstanceOf(HTMLDivElement);
    expect(secondDiv.className).toBe('someClass');
    expect(secondDiv.id).toBe('');

    const thirdDiv = createDivElement(null);
    expect(thirdDiv).toBeInstanceOf(HTMLDivElement);
    expect(thirdDiv.className).toBe('');
    expect(thirdDiv.id).toBe('');
  });
});

describe('createParagraphElement()', () => {
  it('should return a paragraph element with the provided class name and text', () => {
    const firstParagraphElement = createParagraphElement('someClass', 'Some text.');
    expect(firstParagraphElement).toBeInstanceOf(HTMLParagraphElement);
    expect(firstParagraphElement.className).toBe('someClass');
    expect(firstParagraphElement.textContent).toBe('Some text.');

    const secondParagraphElement = createParagraphElement(null, 'Some text.');
    expect(secondParagraphElement).toBeInstanceOf(HTMLParagraphElement);
    expect(secondParagraphElement.className).toBe('');
    expect(secondParagraphElement.textContent).toBe('Some text.');
  });
});

describe('createSpanElement()', () => {
  it('should return a span element with the provided class name and text', () => {
    const firstSpanElement = createSpanElement('someClass', 'Some text.');
    expect(firstSpanElement).toBeInstanceOf(HTMLSpanElement);
    expect(firstSpanElement.className).toBe('someClass');
    expect(firstSpanElement.textContent).toBe('Some text.');

    const secondSpanElement = createSpanElement(null, 'Some text.');
    expect(secondSpanElement).toBeInstanceOf(HTMLSpanElement);
    expect(secondSpanElement.className).toBe('');
    expect(secondSpanElement.textContent).toBe('Some text.');
  });
});

describe('createBtnElement()', () => {
  it('should return a button element with the provided class name, text, and ID', () => {
    const firstBtnElement = createBtnElement('someClass', 'Button Title', 'someId');
    expect(firstBtnElement).toBeInstanceOf(HTMLButtonElement);
    expect(firstBtnElement.getAttribute('type')).toBe('button');
    expect(firstBtnElement.className).toBe('someClass');
    expect(firstBtnElement.textContent).toBe('Button Title');
    expect(firstBtnElement.id).toBe('someId');

    const secondBtnElement = createBtnElement('someClass', 'Button Title');
    expect(secondBtnElement).toBeInstanceOf(HTMLButtonElement);
    expect(secondBtnElement.getAttribute('type')).toBe('button');
    expect(secondBtnElement.className).toBe('someClass');
    expect(secondBtnElement.textContent).toBe('Button Title');
    expect(secondBtnElement.id).toBe('');

    const thirdBtnElement = createBtnElement('someClass', null);
    expect(thirdBtnElement).toBeInstanceOf(HTMLButtonElement);
    expect(thirdBtnElement.getAttribute('type')).toBe('button');
    expect(thirdBtnElement.className).toBe('someClass');
    expect(thirdBtnElement.textContent).toBe('');
    expect(thirdBtnElement.id).toBe('');

    const fourthBtnElement = createBtnElement(null, 'Button Title');
    expect(fourthBtnElement).toBeInstanceOf(HTMLButtonElement);
    expect(fourthBtnElement.getAttribute('type')).toBe('button');
    expect(fourthBtnElement.className).toBe('');
    expect(fourthBtnElement.textContent).toBe('Button Title');
    expect(fourthBtnElement.id).toBe('');

    const fifthBtnElement = createBtnElement(null, null);
    expect(fifthBtnElement).toBeInstanceOf(HTMLButtonElement);
    expect(fifthBtnElement.getAttribute('type')).toBe('button');
    expect(fifthBtnElement.className).toBe('');
    expect(fifthBtnElement.textContent).toBe('');
    expect(fifthBtnElement.id).toBe('');
  });
});

describe('createAnchorElement()', () => {
  it('should return an anchor element with the provided class name, test, link, and a _blank target attribute if specified', () => {
    const firstAnchorElement = createAnchorElement('someClass', 'some text', 'https://hangoutio.com/');
    expect(firstAnchorElement).toBeInstanceOf(HTMLAnchorElement);
    expect(firstAnchorElement.href).toBe('https://hangoutio.com/');
    expect(firstAnchorElement.getAttribute('target')).toBeNull();
    expect(firstAnchorElement.className).toBe('someClass');
    expect(firstAnchorElement.textContent).toBe('some text');

    const secondAnchorElement = createAnchorElement('someClass', 'some text', 'https://hangoutio.com/', true);
    expect(secondAnchorElement).toBeInstanceOf(HTMLAnchorElement);
    expect(secondAnchorElement.href).toBe('https://hangoutio.com/');
    expect(secondAnchorElement.getAttribute('target')).toBe('_blank');
    expect(secondAnchorElement.className).toBe('someClass');
    expect(secondAnchorElement.textContent).toBe('some text');

    const thirdAnchorElement = createAnchorElement('someClass', null, 'https://hangoutio.com/');
    expect(thirdAnchorElement).toBeInstanceOf(HTMLAnchorElement);
    expect(thirdAnchorElement.href).toBe('https://hangoutio.com/');
    expect(thirdAnchorElement.getAttribute('target')).toBeNull();
    expect(thirdAnchorElement.className).toBe('someClass');
    expect(thirdAnchorElement.textContent).toBe('');

    const fourthAnchorElement = createAnchorElement(null, 'some text', 'https://hangoutio.com/');
    expect(fourthAnchorElement).toBeInstanceOf(HTMLAnchorElement);
    expect(fourthAnchorElement.href).toBe('https://hangoutio.com/');
    expect(fourthAnchorElement.getAttribute('target')).toBeNull();
    expect(fourthAnchorElement.className).toBe('');
    expect(fourthAnchorElement.textContent).toBe('some text');

    const fifthAnchorElement = createAnchorElement(null, null, 'https://hangoutio.com/');
    expect(fifthAnchorElement).toBeInstanceOf(HTMLAnchorElement);
    expect(fifthAnchorElement.href).toBe('https://hangoutio.com/');
    expect(fifthAnchorElement.getAttribute('target')).toBeNull();
    expect(fifthAnchorElement.className).toBe('');
    expect(fifthAnchorElement.textContent).toBe('');
  });
});

describe('createSvgElement()', () => {
  it('should return an SVG element with the specified width and height', () => {
    const firstSvgElement = createSvgElement(200, 200);
    expect(firstSvgElement.getAttribute('width')).toBe('200');
    expect(firstSvgElement.getAttribute('height')).toBe('200');
    expect(firstSvgElement.getAttribute('viewBox')).toBe('0 0 200 200');
    expect(firstSvgElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');

    const secondSvgElement = createSvgElement(500, 500);
    expect(secondSvgElement.getAttribute('width')).toBe('500');
    expect(secondSvgElement.getAttribute('height')).toBe('500');
    expect(secondSvgElement.getAttribute('viewBox')).toBe('0 0 500 500');
    expect(secondSvgElement.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');

  });
});