export default function themeSwitcher(): void {
  setTheme();

  const themeBtn: HTMLElement | null = document.querySelector('#theme-switcher');
  themeBtn?.addEventListener('click', changeTheme);
  themeBtn?.addEventListener('keyup', handleThemeBtnKeyEvents);
};

function setTheme(): void {
  const darkThemeItem = localStorage.getItem('darkTheme');
  const darkTheme: boolean = darkThemeItem ? JSON.parse(darkThemeItem) : null;

  if (!darkTheme) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('darkTheme', JSON.stringify(false));
    updateThemeBtn('light');
    return;
  };

  document.documentElement.classList.add('dark');
  updateThemeBtn('dark');
};

function handleThemeBtnKeyEvents(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    changeTheme();
  };
};

function changeTheme(): void {
  const darkThemeItem = localStorage.getItem('darkTheme');
  const darkTheme: boolean = darkThemeItem ? JSON.parse(darkThemeItem) : null;

  if (!darkTheme) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('darkTheme', JSON.stringify(true));
    updateThemeBtn('dark');
    return;
  };

  document.documentElement.classList.remove('dark');
  localStorage.setItem('darkTheme', JSON.stringify(false));
  updateThemeBtn('light');
};

function updateThemeBtn(theme: 'dark' | 'light'): void {
  const themeBtn: HTMLElement | null = document.querySelector('#theme-switcher');

  if (theme === 'dark') {
    themeBtn?.classList.add('dark-theme');
    return;
  };

  themeBtn?.classList.remove('dark-theme');
};