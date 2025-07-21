import { createDivElement, createSpanElement } from "./domUtils";

export default function popup(text: string, type: 'error' | 'success' | 'info', durationMilliseconds: number = 2000): void {
  if (text.trim() === '' || (durationMilliseconds && durationMilliseconds <= 0)) {
    durationMilliseconds = 2000;
  };

  const existingPopup: HTMLDivElement | null = document.querySelector('#popup');
  if (existingPopup) {
    existingPopup.remove();
  };

  const popup: HTMLDivElement = createDivElement(type, 'popup');
  popup.appendChild(createSpanElement(null, text));

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