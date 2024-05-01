function themeSwitcher() {
  setTheme();

  const themeBtn = document.querySelector('#theme-switcher');
  themeBtn.addEventListener('click', changeTheme);
};

function setTheme() {
  const darkTheme = JSON.parse(localStorage.getItem('darkTheme'));

  if(!darkTheme) {
    document.documentElement.classList.remove('dark');
    updateThemeBtn('light');
    return;
  };

  document.documentElement.classList.add('dark');
  updateThemeBtn('dark');
};

function changeTheme(e) {
  e.preventDefault();
  
  const darkTheme = JSON.parse(localStorage.getItem('darkTheme'));
  const themeBtn = document.querySelector('#theme-switcher');

  if(!darkTheme) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('darkTheme', true);
    updateThemeBtn('dark');
    return;
  };

  document.documentElement.classList.remove('dark');
  localStorage.removeItem('darkTheme', false);
  updateThemeBtn('light');
};

function updateThemeBtn(theme) {
  const themeBtn = document.querySelector('#theme-switcher');

  if(theme === 'dark') {
    themeBtn.classList.add('dark-theme');
    return;
  };

  themeBtn.classList.remove('dark-theme');
};

export default themeSwitcher();