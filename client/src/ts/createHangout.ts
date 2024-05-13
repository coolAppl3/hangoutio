import '../scss/main.scss';

import topNavbar from './modules/global/topNavbar';
import botNavbar from './modules/global/botNavbar';
import revealPassword from './modules/global/revealPassword';

// initializing imports
topNavbar();
botNavbar();

function loadEventListeners(): void {
  const accountPasswordIcon: HTMLElement | null = document.querySelector('#password-icon-account');
  accountPasswordIcon?.addEventListener('click', () => { revealPassword(accountPasswordIcon) });
};

function init(): void {
  loadEventListeners();
};

// Starting
init();