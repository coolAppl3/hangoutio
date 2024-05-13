import Cookies from "./Cookies";

export default function botNavbar(): void {
  const botNavbarElement: HTMLElement | null = document.querySelector('.bot-nav');

  displayAdditionalLinks(botNavbarElement);
  botNavbarElement?.addEventListener('click', expandAccountList);
};


function displayAdditionalLinks(botNavbarElement: HTMLElement | null): void {
  const AuthToken: string | undefined = Cookies.get('AuthToken');

  // if (!AuthToken || AuthToken.length !== 32 || !AuthToken.startsWith('a')) {
  //   return;
  // };

  botNavbarElement?.classList.add('signed-in');
};

function expandAccountList(): void {
  const accountListBtn: HTMLElement | null = document.querySelector('#account-list-btn');
  const accountListContainer: HTMLElement | null = document.querySelector('#account-list-container');

  if (accountListBtn?.classList.contains('expanded')) {
    accountListBtn?.classList.remove('expanded');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (accountListContainer) {
          accountListContainer.style.opacity = '0';
        };
      });
    });

    return;
  };

  accountListBtn?.classList.add('expanded');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (accountListContainer) {
        accountListContainer.style.opacity = '1';
      };
    });
  });
};


const test: HTMLElement | null = document.querySelector('#test');

test?.addEventListener('click', () => {
  console.log(true)
});