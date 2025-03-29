import popup from "../global/popup";
import { globalHangoutState } from "./globalHangoutState";

const hangoutDesktopNav: HTMLElement | null = document.querySelector('#hangout-desktop-nav');

const hangoutPhoneNav: HTMLElement | null = document.querySelector('#hangout-phone-nav');
const hangoutPhoneNavBtn: HTMLButtonElement | null = document.querySelector('#hangout-phone-nav-btn');

const hangoutPhoneNavOverlay: HTMLDivElement | null = document.querySelector('#hangout-phone-nav-overlay');
const hangoutPhoneNavMenu: HTMLDivElement | null = document.querySelector('#hangout-phone-nav-menu');

interface HangoutNavState {
  selectedSection: string,
};

const hangoutNavState: HangoutNavState = {
  selectedSection: 'dashboard',
};

export function hangoutNav(): void {
  loadEventListeners();
  updateHangoutSettingsNavButtons();
};

function loadEventListeners(): void {
  hangoutDesktopNav?.addEventListener('click', navigateHangoutSections);

  hangoutPhoneNavBtn?.addEventListener('click', displayPhoneNavMenu);
  hangoutPhoneNavMenu?.addEventListener('click', handlePhoneNavMenuEvents);
};

export function navigateHangoutSections(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  const navigateTo: string | null = e.target.getAttribute('data-goTo');

  if (!navigateTo) {
    return;
  };

  if (navigateTo === 'settings' && !globalHangoutState.data?.isLeader) {
    popup(`You're not the hangout leader.`, 'error');
    return;
  };

  if (navigateTo === 'conclusion' && !globalHangoutState.data?.hangoutDetails.is_concluded) {
    popup(`Hangout hasn't been concluded yet.`, 'error');
    return;
  };

  directlyNavigateHangoutSections(navigateTo);
};

export function directlyNavigateHangoutSections(navigateTo: string): void {
  if (navigateTo === hangoutNavState.selectedSection) {
    return;
  };

  document.querySelector(`#${navigateTo}-section`)?.classList.remove('hidden');
  document.querySelector(`#${hangoutNavState.selectedSection}-section`)?.classList.add('hidden');
  window.scrollTo({ top: 0 });

  hangoutNavState.selectedSection = navigateTo;

  sessionStorage.setItem('latestHangoutSection', navigateTo);
  sessionStorage.setItem('latestHangoutSection_hangoutId', globalHangoutState.data?.hangoutId || 'null');

  hangoutDesktopNav?.setAttribute('data-selected', navigateTo);
  hangoutPhoneNav?.setAttribute('data-selected', navigateTo);
  hidePhoneNavMenu();

  document.dispatchEvent(new CustomEvent(`loadSection-${navigateTo}`));
  toggleFooterVisibility(navigateTo);
};

function displayPhoneNavMenu(): void {
  hangoutPhoneNavOverlay?.classList.remove('hidden');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hangoutPhoneNavOverlay?.classList.add('expanded');
    });
  });
};

function hidePhoneNavMenu(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hangoutPhoneNavOverlay?.classList.remove('expanded');
    });
  });

  setTimeout(() => hangoutPhoneNavOverlay?.classList.add('hidden'), 150);
};

function handlePhoneNavMenuEvents(e: MouseEvent): void {
  if (!(e.target instanceof HTMLButtonElement)) {
    return;
  };

  if (e.target.classList.contains('close-menu-btn')) {
    hidePhoneNavMenu();
    return;
  };

  navigateHangoutSections(e);
};

export function updateHangoutSettingsNavButtons(): void {
  if (!globalHangoutState.data) {
    return;
  };

  const isLeader: boolean = globalHangoutState.data.isLeader;
  const settingsNavButtons: NodeListOf<HTMLButtonElement> = document.querySelectorAll('button[data-goTo="settings"]');

  if (!isLeader) {
    settingsNavButtons.forEach((btn: HTMLButtonElement) => btn.classList.add('hidden'));
    return;
  };

  settingsNavButtons.forEach((btn: HTMLButtonElement) => btn.classList.remove('hidden'));
};

function toggleFooterVisibility(navigateTo: string): void {
  if (navigateTo === 'chat') {
    document.querySelector('footer')?.classList.add('hidden');

    return;
  };

  document.querySelector('footer')?.classList.remove('hidden');
};