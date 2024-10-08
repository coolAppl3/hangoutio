export default function popup(text: string, type: 'error' | 'success' | 'info', durationMilliseconds: number = 2000): void {
  if (text.trim() === '' || (durationMilliseconds && durationMilliseconds <= 0)) {
    durationMilliseconds = 2000;
  };

  const existingPopup: HTMLDivElement | null = document.querySelector('#popup');
  if (existingPopup) {
    existingPopup.remove();
  };

  const popup: HTMLDivElement = createPopup(type);
  popup.appendChild(createSpan(text));

  document.body.appendChild(popup);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      popup.classList.add('in-view');
    });
  });

  setTimeout(() => {
    popup.classList.remove('in-view');
    setTimeout(() => popup.remove(), 150);

  }, durationMilliseconds || 2000);
};

function createPopup(type: string): HTMLDivElement {
  const popup: HTMLDivElement = document.createElement('div');
  popup.id = 'popup';
  popup.className = type;

  return popup;
};

function createSpan(text: string): HTMLSpanElement {
  const span: HTMLSpanElement = document.createElement('span');
  span.appendChild(document.createTextNode(text));

  return span;
};