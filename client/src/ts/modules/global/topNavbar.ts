import themeSwitcher from "./themeSwitcher"
import Cookies from "./Cookies";
import { isValidAuthToken } from "./validation";

export default function topNavbar(): void {
  themeSwitcher();
  displayAdditionalLinks();
  enableAccountNavBtn();
};

function enableAccountNavBtn(): void {
  const accountNavBtn: HTMLButtonElement | null = document.querySelector('#account-nav-container-btn');
  accountNavBtn?.addEventListener('click', (e: MouseEvent) => {
    e.preventDefault();

    const accountContainerLinks: HTMLDivElement | null = document.querySelector('#account-nav-container-links');

    if (accountContainerLinks?.classList.contains('expanded')) {
      setTimeout(() => accountContainerLinks.classList.remove('expanded'), 150);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          accountContainerLinks.style.opacity = '0';
        });
      });

      return;
    };

    accountContainerLinks?.classList.add('expanded');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        accountContainerLinks ? accountContainerLinks.style.opacity = '1' : undefined;
      });
    });
  });
};

function displayAdditionalLinks(): void {
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken || !isValidAuthToken(authToken)) {
    Cookies.remove('authToken');
    return;
  };

  const topNavbarElement: HTMLElement | null = document.querySelector('.top-nav');
  topNavbarElement?.classList.add('signed-in');
};