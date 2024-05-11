import themeSwitcher from "./themeSwitcher"
import Cookies from "./Cookies";

export default function topNavbar(): void {
  themeSwitcher();
  displayAdditionalLinks();
};


function displayAdditionalLinks(): void {
  const AuthToken: string | undefined = Cookies.get('AuthToken');
  const topNavLinksContainer: HTMLElement | null = document.querySelector('.top-nav-container .links-container');

  if (!AuthToken || AuthToken.length !== 32 || !AuthToken.startsWith('a')) {
    return;
  };

  topNavLinksContainer?.classList.add('signed-in');
};