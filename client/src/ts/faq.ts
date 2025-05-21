import '../scss/faq.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import { disableBackForwardCache } from './modules/global/disableBackForwardCache';

disableBackForwardCache();

topNavbar();
botNavbar();

const faqContainer: HTMLDivElement | null = document.querySelector('.faq-container');

function initFaq(): void {
  loadEventListeners();
};

function loadEventListeners(): void {
  faqContainer?.addEventListener('click', toggleFaqItemExpansion);
};

function toggleFaqItemExpansion(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (!e.target.className.includes('toggle-faq-item-btn')) {
    return;
  };

  const faqItem: HTMLElement | null | undefined = e.target.parentElement?.parentElement;

  if (!(faqItem instanceof HTMLDivElement)) {
    return;
  };

  faqItem.classList.toggle('expanded');
};

initFaq();