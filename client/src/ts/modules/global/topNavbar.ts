import themeSwitcher from "./themeSwitcher"
import Cookies from "./Cookies";

export default function topNavbar(): void {
  themeSwitcher();
  displayAdditionalLinks();

};

function displayAdditionalLinks(): void {
  const AuthToken: string | undefined = Cookies.get('AuthToken');
  const topNavbarElement: HTMLElement | null = document.querySelector('.top-nav');

  if (!AuthToken || AuthToken.length !== 32 || !AuthToken.startsWith('a')) {
    return;
  };

  topNavbarElement?.classList.add('signed-in');
};