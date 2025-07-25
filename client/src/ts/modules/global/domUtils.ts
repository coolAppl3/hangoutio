export function createDivElement(className: string | null, id?: string): HTMLDivElement {
  const divElement: HTMLDivElement = document.createElement('div');

  className && (divElement.className = className);
  id && (divElement.id = id);

  return divElement;
};

export function createParagraphElement(className: string | null, text: string): HTMLParagraphElement {
  const paragraphElement: HTMLParagraphElement = document.createElement('p');
  className && (paragraphElement.className = className);
  paragraphElement.appendChild(document.createTextNode(text));

  return paragraphElement;
};

export function createSpanElement(className: string | null, text: string): HTMLSpanElement {
  const spanElement: HTMLSpanElement = document.createElement('span');
  className && (spanElement.className = className);
  spanElement.appendChild(document.createTextNode(text));

  return spanElement;
};

export function createBtnElement(className: string | null, text: string | null, id?: string): HTMLButtonElement {
  const btnElement: HTMLButtonElement = document.createElement('button');
  className && (btnElement.className = className);
  id && (btnElement.id = id);
  text && btnElement.appendChild(document.createTextNode(text));
  btnElement.setAttribute('type', 'button');

  return btnElement;
};

export function createAnchorElement(className: string | null, text: string | null, link: string, isTargetBlank: boolean = false): HTMLAnchorElement {
  const anchorElement: HTMLAnchorElement = document.createElement('a');
  anchorElement.setAttribute('href', link);
  className && (anchorElement.className = className);
  text && anchorElement.appendChild(document.createTextNode(text));
  isTargetBlank && anchorElement.setAttribute('target', '_blank');

  return anchorElement;
};

export function createSvgElement(width: number, height: number): SVGSVGElement {
  const svgElement: SVGSVGElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgElement.setAttribute('width', `${width}`);
  svgElement.setAttribute('height', `${height}`);
  svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  return svgElement;
};