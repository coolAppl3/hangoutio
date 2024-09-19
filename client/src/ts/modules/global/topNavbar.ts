import themeSwitcher from "./themeSwitcher"
import Cookies from "./Cookies";

export default function topNavbar(): void {
  themeSwitcher();
  displayAdditionalLinks();
};

function displayAdditionalLinks(): void {
  const authToken: string | null = Cookies.get('authToken');
  const topNavbarElement: HTMLElement | null = document.querySelector('.top-nav');

  if (!authToken || authToken.length !== 32 || !authToken.startsWith('a')) {
    return;
  };

  topNavbarElement?.classList.add('signed-in');
};