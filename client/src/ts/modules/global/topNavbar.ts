import themeSwitcher from "./themeSwitcher"
import Cookies from "./Cookies";
import { isValidAuthToken } from "./validation";

const topNavbarElement: HTMLElement | null = document.querySelector('.top-nav');

export default function topNavbar(): void {
  themeSwitcher();
  displayRelevantLinks();
  enableAccountNavBtn();
};

function enableAccountNavBtn(): void {
  const accountNavBtn: HTMLButtonElement | null = document.querySelector('#account-nav-container-btn');
  accountNavBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();

    const accountContainerLinks: HTMLDivElement | null = document.querySelector('#account-nav-container-links');

    if (accountContainerLinks?.classList.contains('expanded')) {
      accountNavBtn.classList.remove('expanded')

      setTimeout(() => accountContainerLinks.classList.remove('expanded'), 150);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          accountContainerLinks.style.opacity = '0';
        });
      });

      return;
    };

    accountNavBtn.classList.add('expanded')
    accountContainerLinks?.classList.add('expanded');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        accountContainerLinks ? accountContainerLinks.style.opacity = '1' : undefined;
      });
    });
  });
};

function displayRelevantLinks(): void {
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken) {
    return;
  };

  if (!isValidAuthToken(authToken)) {
    Cookies.remove('authToken');
    return;
  };

  if (authToken.startsWith('g')) {
    topNavbarElement?.classList.add('guest-user');
    return;
  };

  topNavbarElement?.classList.add('account-user');
};