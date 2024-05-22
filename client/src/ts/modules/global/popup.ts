export default function popup(text: string, type: 'error' | 'success' | 'info', durationMilliseconds: number = 2000): void {
  if (text.trim() === '' || (durationMilliseconds && durationMilliseconds <= 0)) {
    durationMilliseconds = 2000;
  };

  const existingPopup: HTMLSpanElement | null = document.querySelector('#popup');
  if (existingPopup) {
    existingPopup.remove();
  };

  const popup: HTMLSpanElement = document.createElement('span');
  popup.id = 'popup';
  popup.className = type;
  popup.appendChild(document.createTextNode(text));

  document.body.appendChild(popup);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      popup.classList.add('in-view');
    });
  });

  setTimeout(() => {
    popup.classList.remove('in-view');
    setTimeout(() => { popup.remove(); }, 150);
  }, durationMilliseconds || 2000);
};